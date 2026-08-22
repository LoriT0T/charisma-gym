/* =========================================================================
   app.js — session orchestration: setup → live sparring → debrief
   ========================================================================= */

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------------------------
   Where the voice backend lives.

   Nine of the ten modules are pure static and need no server at all. Only the
   live call does. That is what lets the app be served from the shared
   lorit0t.github.io origin — which is the whole point, because a path does not
   scope web storage, so sitting on that origin is what makes this app's data
   readable by Dīwān with no API, no paste, and no staleness.

   Served from Pages -> address the backend absolutely.
   Served from Render or localhost -> same origin, as before.
   --------------------------------------------------------------------------- */
const API_ORIGIN = location.hostname.endsWith('github.io')
  ? 'https://charisma-gym.onrender.com'
  : '';
const api = (path) => API_ORIGIN + path;
const wsBase = () => (API_ORIGIN
  ? API_ORIGIN.replace(/^https:/, 'wss:')
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

const App = {
  cfg: null,
  persona: 'blend',
  scenario: 'freestyle',
  voice: '',
  ws: null,
  mic: null,
  player: null,
  orb: null,
  transcript: [],          // [{role, text}] — sent to /api/debrief at the end
  startedAt: 0,
  timerInt: null,
  awaitingSince: 0,
  lastInputAt: 0,
  userCaptionTimeout: null,
  live: false,
};

/* ---------------- boot ---------------- */

async function boot() {
  App.char = new Character($('character'), App.persona);
  try {
    const res = await fetch(api('/api/config'));
    App.cfg = await res.json();
  } catch (e) {
    // The offline modules (warm-up, words, identity, reading, playbook) do not
    // need the backend at all, so a dead server must not take the app down —
    // it only disables the live call.
    const note = $('setup-note');
    if (note) note.textContent = 'Backend unreachable — the live call is unavailable, but every other module works offline.';
    const btn = $('start-btn');
    if (btn) { btn.disabled = true; btn.title = 'Backend unreachable'; }
    return;
  }
  HUD.init(App.cfg.rubric);

  // persona cards — each with a live mini portrait
  const cards = $('persona-cards');
  cards.innerHTML = '';
  for (const [key, p] of Object.entries(App.cfg.personas)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'persona-card' + (key === App.persona ? ' selected' : '');
    btn.dataset.key = key;
    btn.innerHTML = `
      <div class="card-avatar" aria-hidden="true"></div>
      <div class="p-name">${p.name}</div>
      <div class="p-tag">${p.tagline}</div>`;
    new Character(btn.querySelector('.card-avatar'), key);
    btn.addEventListener('click', () => {
      App.persona = key;
      cards.querySelectorAll('.persona-card').forEach((c) => c.classList.toggle('selected', c === btn));
      $('voice').value = App.cfg.personas[key].default_voice;
      $('start-label').textContent = `Call ${p.name}`;
      App.char.setPersona(key);
    });
    cards.appendChild(btn);
  }
  $('start-label').textContent = `Call ${App.cfg.personas[App.persona].name}`;

  // scenario + voice selects
  const scenarioSel = $('scenario');
  for (const [key, label] of Object.entries(App.cfg.scenarios)) {
    scenarioSel.add(new Option(label, key));
  }
  const voiceSel = $('voice');
  for (const [name, style] of Object.entries(App.cfg.voices)) {
    voiceSel.add(new Option(`${name} — ${style}`, name));
  }
  voiceSel.value = App.cfg.personas[App.persona].default_voice;

  if (App.cfg.passcode_required) $('passcode-field').classList.remove('hidden');

  if (App.cfg.mock_mode) {
    $('setup-note').textContent = 'MOCK MODE is on — a scripted coach, no API calls. Set MOCK_MODE=0 in backend/.env for the real thing.';
  } else if (!App.cfg.has_key) {
    $('setup-note').textContent = '⚠ No API key found. Add GEMINI_API_KEY to backend/.env (free at aistudio.google.com/apikey).';
  }

  $('start-btn').addEventListener('click', startSession);
  $('end-btn').addEventListener('click', () => endSession(false));
  $('mute-btn').addEventListener('click', toggleMute);
  $('coach-read-btn').addEventListener('click', () => {
    sendJSON({ type: 'coach_read' });
    toast('Asked the coach for a live read…');
  });
  $('text-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('text-input').value.trim();
    if (v) { sendJSON({ type: 'text', text: v }); $('text-input').value = ''; }
  });
  document.querySelectorAll('.tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.tab-panel').forEach((p) =>
        p.classList.toggle('active', p.id === `tab-${tab.dataset.tab}`));
    })
  );
  $('debrief-close').addEventListener('click', () => $('debrief').classList.add('hidden'));
  $('debrief-again').addEventListener('click', () => location.reload());
  $('debrief-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(App.debriefMd || '');
      toast('Debrief copied.');
    } catch { toast('Copy failed — select the text manually.', true); }
  });

  requestAnimationFrame(orbStateLoop);
}

/* ---------------- session ---------------- */

async function startSession() {
  App.scenario = $('scenario').value;
  App.voice = $('voice').value;
  App.code = $('passcode') ? $('passcode').value.trim() : '';
  $('start-btn').disabled = true;

  if (App.cfg.passcode_required) {
    try {
      const r = await fetch(api(`/api/checkcode?code=${encodeURIComponent(App.code)}`));
      const j = await r.json();
      if (!j.ok) {
        toast('Wrong passcode — ask whoever set up the gym.', true);
        $('start-btn').disabled = false;
        return;
      }
    } catch { /* backend will enforce anyway */ }
  }

  // audio out — plus the iOS silent-switch unlock, inside this tap
  unlockMediaSession();
  App.player = new PcmPlayer(App.cfg.output_rate || 24000);
  window.__player = App.player;
  App.player.resume();
  App.char.getCoachLevel = () => App.player.level();

  // any later tap also re-wakes audio (belt and braces for phones)
  document.addEventListener('pointerdown', () => { App.player && App.player.resume(); unlockMediaSession(); });

  // audio in
  App.mic = new MicStreamer({
    onChunk: (buf) => { if (App.live && App.ws?.readyState === 1) App.ws.send(buf); },
    onLevel: (lv) => { App.char.userLevel = Math.min(1, lv * 7); },
  });
  try {
    await App.mic.start();
  } catch (e) {
    $('start-btn').disabled = false;
    toast('Microphone blocked — allow mic access and try again. (You can still type lines.)', true);
  }

  // websocket
  const url = `${wsBase()}/ws?persona=${App.persona}&scenario=${App.scenario}&voice=${encodeURIComponent(App.voice)}&code=${encodeURIComponent(App.code || '')}`;
  App.ws = new WebSocket(url);
  App.ws.binaryType = 'arraybuffer';
  App.ws.onopen = () => setStatus('connecting');
  App.ws.onmessage = onMessage;
  App.ws.onerror = () => toast('Connection error.', true);
  App.ws.onclose = () => { if (App.live) { setStatus('ended'); App.live = false; } };

  const p = App.cfg.personas[App.persona];
  window.__coachName = p.name.toUpperCase();
  $('caption-coach-name').textContent = p.name.toUpperCase();
  $('coach-chip').textContent = `${p.name} · ${App.voice}`;
  $('scenario-chip').textContent = App.cfg.scenarios[App.scenario];

  $('setup').classList.add('hidden');
  $('app').classList.remove('hidden');
  document.body.classList.add('in-call');   // hides the gym nav for the call view
}

function onMessage(ev) {
  if (ev.data instanceof ArrayBuffer) {
    App.player.enqueue(ev.data);
    App.awaitingSince = 0;
    return;
  }
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }

  switch (msg.type) {
    case 'status':
      if (msg.state === 'connected') {
        App.live = true;
        setStatus('connected');
        App.player.chime();   // you should hear this — instant proof sound works
        startAudioWatchdog();
        if (msg.model === 'mock-mode') toast('Mock mode: a scripted stand-in, no API calls.');
        startTimer();
      } else if (msg.state === 'ended') {
        App.live = false;
        setStatus('ended');
      }
      break;

    case 'input_transcript':
      App.lastInputAt = performance.now();
      showCaption('user', msg.text);
      if (msg.final) {
        App.transcript.push({ role: 'user', text: msg.text });
        HUD.addTranscript('user', msg.text);
        clearTimeout(App.userCaptionTimeout);
        App.userCaptionTimeout = setTimeout(() => hideCaption('user'), 3500);
        App.awaitingSince = performance.now();
      }
      break;

    case 'output_transcript':
      App.awaitingSince = 0;
      showCaption('coach', msg.text);
      if (msg.final) {
        App.transcript.push({ role: 'coach', text: msg.text });
        HUD.addTranscript('coach', msg.text);
      }
      break;

    case 'turn_complete':
      setTimeout(() => { if (!App.player.speaking) hideCaption('coach'); }, 2600);
      break;

    case 'interrupted':
      App.player.flush();
      hideCaption('coach');
      break;

    case 'feedback':
      HUD.addFeedback(msg);
      break;

    case 'session_expiring':
      toast('The voice session is about to hit its time limit — wrap up for your debrief.');
      break;

    case 'session_expired':
      toast('Voice session hit its limit. Fetching your debrief…');
      endSession(true);
      break;

    case 'error':
      toast(msg.message, true);
      setStatus('error');
      break;
  }
}

async function endSession(auto) {
  if (App.ws && App.ws.readyState === 1 && !auto) sendJSON({ type: 'end' });
  // a finished call is an attempt, and attempts are the number that matters
  if (App.transcript.length) {
    try {
      Store.addRep('call');
      const fb = HUD.exportState();
      if (fb && fb.length) {
        const keys = Object.keys(fb[0].scores);
        const scores = {};
        for (const k of keys) scores[k] = Math.round(fb.reduce((x, f) => x + f.scores[k], 0) / fb.length);
        Store.logCall({
          persona: App.persona, scenario: App.scenario, scores,
          overall: Math.round(fb.reduce((x, f) => x + f.overall, 0) / fb.length),
          turns: App.transcript.filter((t) => t.role === 'user').length,
          seconds: App.startedAt ? Math.round((Date.now() - App.startedAt) / 1000) : 0,
        });
      }
    } catch (e) { console.warn('could not persist call', e); }
  }
  App.live = false;
  setStatus('ended');
  stopTimer();
  try { App.mic && (await App.mic.stop()); } catch {}
  try { App.ws && App.ws.close(); } catch {}
  stopAudioWatchdog();
  App.char.setState('idle');

  // fold any unfinished captions into the transcript
  $('debrief').classList.remove('hidden');
  $('debrief-body').innerHTML = '<div class="debrief-loading">The coach is writing your report card…</div>';
  try {
    const res = await fetch(api('/api/debrief'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: App.persona,
        transcript: App.transcript,
        feedback_history: HUD.exportState(),
        code: App.code || '',
      }),
    });
    const data = await res.json();
    App.debriefMd = data.markdown;
    $('debrief-body').innerHTML = renderMarkdown(data.markdown);
  } catch (e) {
    $('debrief-body').innerHTML =
      '<p>Could not generate the debrief — the backend may be offline. Your History tab still has every scored turn.</p>';
  }
}

/* ---------------- helpers ---------------- */

function sendJSON(obj) {
  if (App.ws && App.ws.readyState === 1) App.ws.send(JSON.stringify(obj));
}

function setStatus(state) {
  const el = $('conn-status');
  el.dataset.state = state;
  el.textContent = state === 'connected' ? 'live' : state;
}

function toggleMute() {
  if (!App.mic) return;
  const m = !App.mic.muted;
  App.mic.setMuted(m);
  $('mute-btn').setAttribute('aria-pressed', String(m));
  $('mute-btn').title = m ? 'Unmute microphone' : 'Mute microphone';
  toast(m ? 'Mic muted.' : 'Mic live.');
}

function showCaption(who, text) {
  const el = $(`caption-${who}`);
  el.classList.remove('hidden');
  el.querySelector('.caption-text').textContent = text;
}
function hideCaption(who) { $(`caption-${who}`).classList.add('hidden'); }

function startTimer() {
  App.startedAt = Date.now();
  App.timerInt = setInterval(() => {
    const s = Math.floor((Date.now() - App.startedAt) / 1000);
    $('timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}
function stopTimer() { clearInterval(App.timerInt); }

let toastTimeout;
function toast(text, isError) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.add('hidden'), 4200);
}

function orbStateLoop() {
  if (App.player && App.player.speaking) {
    App.char.setState('speaking');
  } else if (App.awaitingSince && performance.now() - App.awaitingSince > 350) {
    App.char.setState('thinking');
  } else if (App.live) {
    App.char.setState('listening');
  } else {
    App.char.setState('idle');
  }
  requestAnimationFrame(orbStateLoop);
}

/* If audio has been arriving but the output context is blocked (phone
   autoplay rules, silent switch weirdness), tell the user how to fix it. */
let watchdogInt;
function startAudioWatchdog() {
  stopAudioWatchdog();
  watchdogInt = setInterval(() => {
    if (!App.player) return;
    if (App.player.enqueuedBytes > 60000 && App.player.ctx.state !== 'running') {
      toast('🔊 Sound is blocked — tap anywhere to enable it. (iPhone: also check the ring/silent switch.)', true);
    }
  }, 3000);
}
function stopAudioWatchdog() { clearInterval(watchdogInt); }

/* The gym shell boots independently of the backend so the offline modules are
   always available; the call config loads alongside it. */
Gym.boot();
boot();
