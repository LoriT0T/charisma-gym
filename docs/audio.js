/* =========================================================================
   audio.js — microphone capture (→16kHz PCM16) and coach playback (24kHz)
   ========================================================================= */

const WORKLET_SOURCE = `
class Downsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;   // e.g. 48000/16000 = 3
    this.pos = 0;            // fractional read position within the stream
    this.tail = null;        // last sample of previous block (for interpolation)
    this.out = new Int16Array(2048);             // ~128ms per packet at 16kHz
    this.outLen = 0;
    this.level = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;

    // stitch previous tail onto this block so interpolation is continuous
    const buf = this.tail !== null ? new Float32Array(ch.length + 1) : ch;
    if (this.tail !== null) { buf[0] = this.tail; buf.set(ch, 1); }

    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    this.level = Math.max(this.level * 0.82, Math.sqrt(sum / ch.length));

    while (this.pos + 1 < buf.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const s = buf[i] * (1 - frac) + buf[i + 1] * frac;
      this.out[this.outLen++] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
      if (this.outLen === this.out.length) {
        const packet = this.out.slice(0, this.outLen);
        this.port.postMessage({ pcm: packet.buffer, level: this.level }, [packet.buffer]);
        this.outLen = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= (buf.length - 1);        // carry leftover fraction into next block
    this.tail = buf[buf.length - 1];
    return true;
  }
}
registerProcessor('downsampler', Downsampler);
`;

class MicStreamer {
  constructor({ onChunk, onLevel }) {
    this.onChunk = onChunk;
    this.onLevel = onLevel;
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.muted = false;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const blobUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
    );
    await this.ctx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'downsampler');
    this.node.port.onmessage = (e) => {
      if (this.onLevel) this.onLevel(this.muted ? 0 : e.data.level);
      if (!this.muted && this.onChunk) this.onChunk(e.data.pcm);
    };
    source.connect(this.node);
    // worklet is a sink; no need to reach the speakers
  }

  setMuted(m) { this.muted = m; }

  async stop() {
    try { this.node && this.node.disconnect(); } catch (_) {}
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { this.ctx && (await this.ctx.close()); } catch (_) {}
    this.ctx = this.stream = this.node = null;
  }
}

/**
 * iOS mutes WebAudio when the ringer switch is on silent — unless the page is
 * in a "playback" media session. A looping (near-)silent <audio> element,
 * started inside a user gesture, flips that switch for us.
 */
function unlockMediaSession() {
  try {
    if (window.__unlockAudio) { window.__unlockAudio.play().catch(() => {}); return; }
    const a = document.createElement('audio');
    a.src = 'data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    a.loop = true;
    a.volume = 0.01;
    a.setAttribute('playsinline', '');
    a.play().catch(() => {});
    window.__unlockAudio = a;
  } catch (_) {}
}

class PcmPlayer {
  constructor(sampleRate = 24000) {
    this.rate = sampleRate;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.75;
    this.analyser.connect(this.ctx.destination);
    this.playhead = 0;
    this.sources = new Set();
    this.enqueuedBytes = 0;
    this._fft = new Uint8Array(this.analyser.frequencyBinCount);

    /* ── the jitter buffer ──
       The old scheduler gave each network chunk a 60ms cushion. On a fast
       desktop connection chunks arrive in bursts well ahead of playback and
       the cushion never matters; on a phone with real latency each chunk
       lands AFTER the previous one has finished — a fresh 60ms gap between
       every chunk, which the ear hears as speech chopped word by word.

       Two changes. Chunks are coalesced into ~180ms buffers before being
       scheduled, so scheduling overhead and boundary artefacts drop by an
       order of magnitude. And the cushion is adaptive: it starts generous,
       and every underrun teaches it — one brief pause per bad patch of
       network, instead of a stutter on every word. */
    this.pending = [];          // Int16Arrays waiting to be coalesced
    this.pendingLen = 0;
    this.lead = 0.30;           // current cushion, seconds
    this.underruns = 0;
    this._flushTimer = null;

    /* iOS suspends the context on audio-session interruptions (the mic
       starting, a notification sound, a route change). currentTime freezes
       while suspended, so on resume the playhead is rebuilt rather than
       trusted. */
    this.ctx.addEventListener('statechange', () => {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
        this.playhead = 0;
      }
    });
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

  /** short two-note bell so the user instantly knows sound is working */
  chime() {
    this.resume();
    const sr = this.ctx.sampleRate;
    const dur = 0.55;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      const t = i / sr;
      const f = t < 0.22 ? 659 : 880;
      const env = Math.exp(-4.5 * (t < 0.22 ? t : t - 0.22)) * 0.22;
      ch[i] = env * Math.sin(2 * Math.PI * f * t) * (1 + 0.3 * Math.sin(2 * Math.PI * f * 2 * t));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);
    src.start(this.ctx.currentTime + 0.05);
  }

  enqueue(arrayBuffer) {
    this.enqueuedBytes += arrayBuffer.byteLength;
    const int16 = new Int16Array(arrayBuffer);
    if (!int16.length) return;
    this.pending.push(int16);
    this.pendingLen += int16.length;

    /* Ship a coalesced buffer once ~180ms is gathered; a short timer catches
       the tail of an utterance that never fills the batch. */
    const BATCH = Math.floor(this.rate * 0.18);
    if (this.pendingLen >= BATCH) this._ship();
    else if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => { this._flushTimer = null; this._ship(); }, 90);
    }
  }

  _ship() {
    if (!this.pendingLen) return;
    const all = new Float32Array(this.pendingLen);
    let o = 0;
    for (const c of this.pending) {
      for (let i = 0; i < c.length; i++) all[o + i] = c[i] / 32768;
      o += c.length;
    }
    this.pending = [];
    this.pendingLen = 0;

    const buf = this.ctx.createBuffer(1, all.length, this.rate);
    buf.copyToChannel(all, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);

    const now = this.ctx.currentTime;
    if (this.playhead <= now) {
      /* Underrun: the network fell behind the voice. Rebuild the cushion —
         and grow it a little each time, so a genuinely slow link converges on
         one pause per rough patch rather than a stutter per word. */
      if (this.playhead !== 0) {
        this.underruns++;
        this.lead = Math.min(0.6, this.lead + 0.08);
      }
      this.playhead = now + this.lead;
    }
    src.start(this.playhead);
    this.playhead += buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  flush() {
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
    this.pending = [];
    this.pendingLen = 0;
    for (const s of this.sources) { try { s.stop(); } catch (_) {} }
    this.sources.clear();
    this.playhead = 0;
  }

  get speaking() {
    return this.playhead > this.ctx.currentTime + 0.02;
  }

  /** 0..1 loudness of what's playing right now (for the orb) */
  level() {
    if (!this.speaking) return 0;
    this.analyser.getByteFrequencyData(this._fft);
    let sum = 0;
    for (let i = 0; i < this._fft.length; i++) sum += this._fft[i];
    return Math.min(1, (sum / this._fft.length) / 140);
  }

  waveform(target) {
    this.analyser.getByteTimeDomainData(target);
    return target;
  }

  async close() { try { await this.ctx.close(); } catch (_) {} }
}

window.MicStreamer = MicStreamer;
window.PcmPlayer = PcmPlayer;
window.unlockMediaSession = unlockMediaSession;
