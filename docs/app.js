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
/* The backend is RESOLVED, not assumed.

   On 2026-08-22 the Render service was renamed by editing `name:` in
   render.yaml. Render keys blueprint services by name, so that did not rename
   anything — it stood up a SECOND service and left the original running. The
   duplicate came up without GEMINI_API_KEY, because secrets marked sync:false
   are not carried over. This file pointed at the new name, so every call failed
   and the app reported "No API key found" — sending you to look for a key that
   was never missing. It was on the other host the whole time.

   So the origin is now a short ordered list, resolved once at boot: take the
   first backend that answers WITH a key. A backend with no key cannot place a
   call, which makes it the wrong answer even when it responds. Same idea as the
   model fallback chain in config.py, applied one layer out.

   Cost is bounded. The healthy path fetches exactly one origin — the fallback
   is only probed when the primary answers and says it has no key. The winner is
   remembered so later loads go straight to it. */
const BACKENDS = [
  'https://charisma-gym.onrender.com',   // the name the service should have
  'https://good-company.onrender.com'    // the original, still holding the key
];
const BACKEND_MEMO = 'charismagym.backend';

const LOCAL_ORIGIN = !location.hostname.endsWith('github.io');
let API_ORIGIN = LOCAL_ORIGIN ? '' : BACKENDS[0];

const api = (path) => API_ORIGIN + path;
const wsBase = () => (API_ORIGIN
  ? API_ORIGIN.replace(/^https:/, 'wss:')
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

/** One candidate's /api/config, or null. `patient` waits out a cold start. */
async function askBackend(origin, patient) {
  const ctl = new AbortController();
  /* Render's free tier sleeps after 15 minutes and takes about a minute to wake,
     so the first candidate is given as long as it needs. A fallback probe is
     already the unhappy path and must not hold boot open indefinitely. */
  const t = patient ? null : setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(origin + '/api/config', { signal: ctl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
  finally { if (t) clearTimeout(t); }
}

/**
 * Decide which backend to talk to. Returns { cfg, origin, note } where `note`
 * describes anything the user needs to know about the choice.
 */
async function resolveBackend() {
  if (LOCAL_ORIGIN) return { cfg: await askBackend('', true), origin: '', note: null };

  /* The canonical name is always asked FIRST, never reordered by what worked
     last time. Remembering a winning sibling and going straight back to it looks
     like a saving and is a trap: the app would pin itself to the old host and
     keep using it after the rename is done, still showing the warning, with
     nothing to make it look again. Preference order is a decision, not a cache.

     What the memo is for: ordering the fallbacks among themselves, so a sibling
     known to work is tried before one that has never answered. */
  const order = [BACKENDS[0], ...rest()];
  function rest() {
    const others = BACKENDS.slice(1);
    try {
      const memo = localStorage.getItem(BACKEND_MEMO);
      if (memo && others.includes(memo)) return [memo, ...others.filter(o => o !== memo)];
    } catch { /* storage blocked; declared order is fine */ }
    return others;
  }

  let fallbackCfg = null, fallbackOrigin = null;
  for (let i = 0; i < order.length; i++) {
    const cfg = await askBackend(order[i], i === 0);
    if (!cfg) continue;
    if (cfg.has_key || cfg.mock_mode) {
      try {
        if (order[i] === BACKENDS[0]) localStorage.removeItem(BACKEND_MEMO);
        else localStorage.setItem(BACKEND_MEMO, order[i]);
      } catch { /* fine */ }
      const note = order[i] === BACKENDS[0] ? null
        : `Running against ${new URL(order[i]).hostname}. The service is renamed, but the charisma-gym URL is still held by the suspended duplicate — deleting that service frees it. Nothing is broken by this; the call works either way.`;
      return { cfg, origin: order[i], note };
    }
    if (!fallbackCfg) { fallbackCfg = cfg; fallbackOrigin = order[i]; }
  }

  /* Every backend answered and none had a key. Show the app rather than a blank
     screen, and say the true thing about why the call is off. */
  if (fallbackCfg) return { cfg: fallbackCfg, origin: fallbackOrigin, note: null };
  return { cfg: null, origin: null, note: null };
}

const App = {
  cfg: null,
  origin: null,            // which backend resolveBackend() settled on
  originNote: null,        // anything the user should know about that choice
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
  const found = await resolveBackend();
  if (!found.cfg) {
    // The offline modules (warm-up, words, identity, reading, playbook) do not
    // need the backend at all, so a dead server must not take the app down —
    // it only disables the live call.
    const note = $('setup-note');
    if (note) note.textContent = 'Backend unreachable — the live call is unavailable, but every other module works offline. Render sleeps after 15 minutes idle and takes about a minute to wake, so this may just need a reload.';
    const btn = $('start-btn');
    if (btn) { btn.disabled = true; btn.title = 'Backend unreachable'; }
    return;
  }
  App.cfg = found.cfg;
  App.origin = found.origin;
  App.originNote = found.note;
  if (found.origin !== null) API_ORIGIN = found.origin;
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

  /* Say the true thing. The old message here named backend/.env unconditionally,
     which is only where the key lives when you are running this on your own Mac —
     on the hosted app there is no .env, and pointing at one is how a working key
     sitting in Render's environment gets hunted for in the wrong place. */
  const hosted = !LOCAL_ORIGIN;
  const note = $('setup-note');
  if (App.cfg.mock_mode) {
    note.textContent = 'MOCK MODE is on — a scripted coach, no API calls. Set MOCK_MODE=0 for the real thing.';
  } else if (!App.cfg.has_key) {
    note.innerHTML = hosted
      ? `⚠ <b>${esc(new URL(API_ORIGIN).hostname)} has no API key.</b> Set <code>GEMINI_API_KEY</code> on that service in the Render dashboard — Environment → Add. Every other module works without it.`
      : '⚠ No API key found. Add GEMINI_API_KEY to backend/.env (free at aistudio.google.com/apikey).';
    const b = $('start-btn'); if (b) { b.disabled = true; b.title = 'No API key on the backend'; }
  } else if (hosted && !App.cfg.passcode_required) {
    /* An unguarded key on a public URL. The backend's own gate returns True for
       everyone when APP_PASSCODE is empty, so this is not a theoretical risk:
       the address is permanent and public, and anyone who loads it talks to your
       friend, shares its memory, and spends your quota. */
    note.innerHTML = `⚠ <b>This backend has a key and no door code.</b> ${esc(new URL(API_ORIGIN).hostname)} is public, so anyone with the link can place calls on your quota. Set <code>APP_PASSCODE</code> on it in the Render dashboard.`;
  } else if (App.originNote) {
    note.textContent = App.originNote;
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
