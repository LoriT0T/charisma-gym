/* =========================================================================
   store.js — local persistence and the event log.

   Deliberately localStorage, not the server. The backend runs on an ephemeral
   free-tier container: its disk is wiped on every rebuild and every wake from
   sleep. A training history that resets when the host restarts is worse than
   none, because you would trust it. The browser outlives the container.

   Trade-off, stated plainly: this is per-device. Export/import is the bridge.

   ARCHITECTURE — one append-only event log, many derived views.
   Every meaningful action writes an immutable event. Streaks, trends,
   calibration and prescriptions are all *computed* from that log rather than
   stored as their own mutable counters. This is what makes the system
   evolvable: a new question about your progress becomes a new reducer over
   history you already have, not a schema migration and six months of waiting
   for fresh data.
   ========================================================================= */

const STORE_KEY = 'charismagym.v1';
// Older keys, newest first. Renaming the product must never orphan a training
// history — these are read once and migrated forward.
const LEGACY_KEYS = ['goodcompany.v2', 'goodcompany.v1'];

const BLANK = {
  version: 2,
  events:   [],          // append-only. the source of truth.
  vocab:    { learned: {}, seen: {} },
  identity: { active: [], evidence: [] },
  field:    [],          // real-world interaction log — reality -> system
  experiments: [],       // hypothesis -> reps -> verdict
  playbook: [],          // personally validated moves, promoted from experiments
  reviews:  [],          // weekly closes of the loop
  calls:    [],          // persisted analyzer output from live calls
  settings: { dailyWords: 5 },
};

const MAX_EVENTS = 4000;

function _read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...structuredClone(BLANK), ...parsed };
    }
    return _migrateLegacy();
  } catch {
    return structuredClone(BLANK);
  }
}

/** Carry any older save forward rather than stranding it. */
function _migrateLegacy() {
  const base = structuredClone(BLANK);
  try {
    let old = null;
    for (const k of LEGACY_KEYS) {
      const raw = localStorage.getItem(k);
      if (raw) { old = JSON.parse(raw); break; }
    }
    if (!old) return base;
    // goodcompany.v2 already had the event log; take it wholesale
    if (Array.isArray(old.events)) {
      const carried = { ...base, ...old, version: 2 };
      _write(carried);
      return carried;
    }
    if (old.vocab)    base.vocab    = { learned: old.vocab.learned || {}, seen: old.vocab.seen || {} };
    if (old.identity) base.identity = old.identity;
    // v1 kept counters; replay them as events so history is not lost
    for (const [day, n] of Object.entries(old.reps || {})) {
      for (let i = 0; i < n; i++) base.events.push({ type: 'rep', day, at: Date.parse(day) || Date.now(), payload: {} });
    }
    for (const d of (old.drills?.log || [])) {
      base.events.push({ type: 'drill', day: d.day, at: d.at, payload: { name: d.name, seconds: d.seconds } });
    }
    _write(base);
  } catch { /* a failed migration must never block the app */ }
  return base;
}

function _write(data) {
  try {
    if (data.events.length > MAX_EVENTS) data.events = data.events.slice(-MAX_EVENTS);
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('store: could not save', e);
    return false;
  }
}

/* LOCAL day key, not UTC. toISOString() is UTC, which pushes anything logged
   between midnight and 01:00 BST onto the previous day — the sibling apps and
   Dīwān all key on local dates, so a UTC key here made this app disagree with
   the rest of the ecosystem about what happened today. */
const dayOf = (ts) => {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};

const Store = {
  all() { return _read(); },

  update(fn) { const d = _read(); fn(d); _write(d); return d; },

  today() { return dayOf(Date.now()); },

  /* ===================== the log ===================== */

  logEvent(type, payload = {}) {
    return Store.update((d) => {
      d.events.push({ type, payload, day: Store.today(), at: Date.now() });
    });
  },

  events(type, sinceDays) {
    const d = _read();
    const cutoff = sinceDays ? Date.now() - sinceDays * 86400000 : 0;
    return d.events.filter((e) =>
      (!type || e.type === type) && e.at >= cutoff);
  },

  /* ===================== reps ===================== */

  addRep(source = 'manual') { return Store.logEvent('rep', { source }); },

  repsThisWeek() { return Store.events('rep', 7).length; },

  /** Consecutive days with at least one logged event of any kind. */
  streak() {
    const days = new Set(_read().events.map((e) => e.day));
    let n = 0;
    for (let i = 0; ; i++) {
      const day = dayOf(Date.now() - i * 86400000);
      if (days.has(day)) { n++; continue; }
      if (i === 0) continue;          // today not yet logged is fine
      break;
    }
    return n;
  },

  /* ===================== vocabulary ===================== */

  markSeen(word) {
    return Store.update((d) => { d.vocab.seen[word] = (d.vocab.seen[word] || 0) + 1; });
  },

  /** A word locks in after correct recall on three DISTINCT days. Same-day
   *  repeats do not count — massed practice inflates the count without
   *  building retention, and a number you cannot trust is worse than none. */
  markRecalled(word, correct) {
    Store.logEvent('vocab', { word, correct });
    return Store.update((d) => {
      const rec = d.vocab.learned[word] || { hits: 0, days: [], learnedOn: null };
      const day = Store.today();
      if (correct) {
        if (!rec.days.includes(day)) { rec.days.push(day); rec.hits += 1; }
        if (rec.hits >= 3 && !rec.learnedOn) rec.learnedOn = day;
      } else {
        rec.hits = Math.max(0, rec.hits - 1);
        rec.learnedOn = null;
      }
      d.vocab.learned[word] = rec;
    });
  },

  learnedList() {
    return Object.entries(_read().vocab.learned)
      .filter(([, r]) => r.learnedOn).map(([word, r]) => ({ word, ...r }));
  },
  inProgressList() {
    return Object.entries(_read().vocab.learned)
      .filter(([, r]) => !r.learnedOn && r.hits > 0).map(([word, r]) => ({ word, ...r }));
  },

  /* ===================== identity ===================== */

  setActiveIdentities(list) { return Store.update((d) => { d.identity.active = list; }); },

  logEvidence(identity, text) {
    Store.logEvent('identity', { identity, text });
    return Store.update((d) => {
      d.identity.evidence.unshift({ identity, text, day: Store.today(), at: Date.now() });
      d.identity.evidence = d.identity.evidence.slice(0, 500);
    });
  },
  evidenceFor(identity) { return _read().identity.evidence.filter((e) => e.identity === identity); },

  /* ===================== drills ===================== */

  logDrill(name, seconds) { return Store.logEvent('drill', { name, seconds }); },

  drillSeconds() {
    return Store.events('drill').reduce((a, e) => a + (e.payload.seconds || 0), 0);
  },

  /* ===================== field log =====================
     The only channel from real life back into the system. Everything else in
     this app is simulation; this is the measurement. */

  logField(entry) {
    Store.logEvent('field', { outcome: entry.outcome, technique: entry.technique });
    Store.logEvent('rep', { source: 'field' });
    return Store.update((d) => {
      d.field.unshift({ ...entry, day: Store.today(), at: Date.now() });
      d.field = d.field.slice(0, 400);
    });
  },

  field(sinceDays) {
    const cutoff = sinceDays ? Date.now() - sinceDays * 86400000 : 0;
    return _read().field.filter((f) => f.at >= cutoff);
  },

  /** Calibration: mean |predicted − actual| on a 1–5 scale, plus direction.
   *  Positive bias = you consistently expect it to go worse than it does,
   *  which is the single most common and most costly pattern here. */
  calibration() {
    const withPred = _read().field.filter((f) => f.predicted != null && f.outcome != null);
    if (!withPred.length) return null;
    const errs = withPred.map((f) => f.outcome - f.predicted);
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    const absMean = errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length;
    return { n: withPred.length, bias: mean, error: absMean, points: withPred.slice(0, 40) };
  },

  /* ===================== experiments ===================== */

  addExperiment(exp) {
    Store.logEvent('experiment', { action: 'start', hypothesis: exp.hypothesis });
    return Store.update((d) => {
      d.experiments.unshift({
        ...exp, id: 'x' + Date.now(), reps: 0, status: 'running',
        started: Store.today(), at: Date.now(),
      });
    });
  },

  tickExperiment(id) {
    return Store.update((d) => {
      const x = d.experiments.find((e) => e.id === id);
      if (x && x.status === 'running') x.reps += 1;
    });
  },

  resolveExperiment(id, verdict, note) {
    Store.logEvent('experiment', { action: 'resolve', verdict });
    return Store.update((d) => {
      const x = d.experiments.find((e) => e.id === id);
      if (!x) return;
      x.status = 'done'; x.verdict = verdict; x.note = note; x.ended = Store.today();
      // a confirmed experiment graduates into the personal playbook — this is
      // the mechanism by which generic advice is replaced by your own evidence
      if (verdict === 'works') {
        d.playbook.unshift({
          move: x.hypothesis, technique: x.technique, note,
          reps: x.reps, provenOn: Store.today(),
        });
      }
    });
  },

  /* ===================== calls ===================== */

  /** Persist what the analyzer already produced. Without this the app throws
   *  away its highest-quality signal every time a call ends. */
  logCall({ persona, scenario, scores, overall, turns, seconds }) {
    Store.logEvent('call', { persona, overall });
    return Store.update((d) => {
      d.calls.unshift({ persona, scenario, scores, overall, turns, seconds,
                        day: Store.today(), at: Date.now() });
      d.calls = d.calls.slice(0, 200);
    });
  },

  calls() { return _read().calls; },

  /** Mean score per rubric dimension over the most recent n calls. */
  dimensionAverages(n = 10) {
    const cs = _read().calls.filter((c) => c.scores).slice(0, n);
    if (!cs.length) return null;
    const keys = Object.keys(cs[0].scores);
    const out = {};
    for (const k of keys) {
      out[k] = Math.round(cs.reduce((a, c) => a + (c.scores[k] || 0), 0) / cs.length);
    }
    return out;
  },

  /** Weakest dimension — the thing the prescription engine targets. */
  weakestDimension() {
    const avg = Store.dimensionAverages();
    if (!avg) return null;
    return Object.entries(avg).sort((a, b) => a[1] - b[1])[0];
  },

  /* ===================== reviews ===================== */

  addReview(text, snapshot) {
    Store.logEvent('review', {});
    return Store.update((d) => {
      d.reviews.unshift({ text, snapshot, day: Store.today(), at: Date.now() });
      d.reviews = d.reviews.slice(0, 100);
    });
  },
  reviews() { return _read().reviews; },
  daysSinceReview() {
    const r = _read().reviews[0];
    if (!r) return null;
    return Math.floor((Date.now() - r.at) / 86400000);
  },

  /* ===================== portability ===================== */

  exportJSON() { return JSON.stringify(_read(), null, 2); },

  importJSON(text) {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    if (!Array.isArray(parsed.events)) throw new Error('missing event log');
    _write({ ...structuredClone(BLANK), ...parsed });
    return true;
  },

  reset() { _write(structuredClone(BLANK)); },
};

window.Store = Store;
