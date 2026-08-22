/* =========================================================================
   store.js — local persistence.

   Deliberately localStorage, not the server. The backend runs on an ephemeral
   free-tier container: its disk is wiped on every rebuild and every wake from
   sleep. A vocabulary log that resets when the host restarts is worse than no
   log at all, because you would trust it. The browser outlives the container.

   Trade-off, stated plainly: this is per-device. Your phone and your laptop
   keep separate progress. Export/import below is the bridge.
   ========================================================================= */

const STORE_KEY = 'goodcompany.v1';

const BLANK = {
  vocab:    { learned: {}, seen: {}, streak: 0, lastDay: null },
  identity: { active: [], evidence: [] },
  drills:   { log: [], totalSeconds: 0 },
  reps:     {},          // { yyyy-mm-dd: count } — attempts, the thing you control
  settings: { dailyWords: 5 },
};

function _read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(BLANK);
    const parsed = JSON.parse(raw);
    // shallow-merge so a new field in BLANK never breaks an old save
    return { ...structuredClone(BLANK), ...parsed };
  } catch {
    return structuredClone(BLANK);
  }
}

function _write(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('store: could not save', e);
    return false;
  }
}

const Store = {
  all() { return _read(); },

  update(fn) {
    const d = _read();
    fn(d);
    _write(d);
    return d;
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  /* ---------------- vocabulary ---------------- */

  markSeen(word) {
    return Store.update((d) => {
      d.vocab.seen[word] = (d.vocab.seen[word] || 0) + 1;
    });
  },

  /** Spaced repetition, deliberately simple: a word is "learned" after it has
   *  been recalled correctly on three separate days. Same-day repeats do not
   *  count — massed practice inflates the count without building retention. */
  markRecalled(word, correct) {
    return Store.update((d) => {
      const rec = d.vocab.learned[word] || { hits: 0, days: [], learnedOn: null };
      const day = Store.today();
      if (correct) {
        if (!rec.days.includes(day)) {
          rec.days.push(day);
          rec.hits += 1;
        }
        if (rec.hits >= 3 && !rec.learnedOn) rec.learnedOn = day;
      } else {
        // a miss costs one day of credit, never drops below zero
        rec.hits = Math.max(0, rec.hits - 1);
        rec.learnedOn = null;
      }
      d.vocab.learned[word] = rec;
    });
  },

  learnedList() {
    const d = _read();
    return Object.entries(d.vocab.learned)
      .filter(([, r]) => r.learnedOn)
      .map(([word, r]) => ({ word, ...r }));
  },

  inProgressList() {
    const d = _read();
    return Object.entries(d.vocab.learned)
      .filter(([, r]) => !r.learnedOn && r.hits > 0)
      .map(([word, r]) => ({ word, ...r }));
  },

  /* ---------------- identity ---------------- */

  setActiveIdentities(list) {
    return Store.update((d) => { d.identity.active = list; });
  },

  logEvidence(identity, text) {
    return Store.update((d) => {
      d.identity.evidence.unshift({
        identity, text, day: Store.today(), at: Date.now(),
      });
      d.identity.evidence = d.identity.evidence.slice(0, 500);
    });
  },

  evidenceFor(identity) {
    return _read().identity.evidence.filter((e) => e.identity === identity);
  },

  /* ---------------- drills ---------------- */

  logDrill(name, seconds) {
    return Store.update((d) => {
      d.drills.log.unshift({ name, seconds, day: Store.today(), at: Date.now() });
      d.drills.log = d.drills.log.slice(0, 400);
      d.drills.totalSeconds += seconds;
    });
  },

  /* ---------------- reps (attempts) ---------------- */

  addRep(n = 1) {
    return Store.update((d) => {
      const day = Store.today();
      d.reps[day] = (d.reps[day] || 0) + n;
    });
  },

  repsThisWeek() {
    const d = _read();
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      total += d.reps[day] || 0;
    }
    return total;
  },

  /* ---------------- day streak ---------------- */

  touchDay() {
    return Store.update((d) => {
      const day = Store.today();
      if (d.vocab.lastDay === day) return;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      d.vocab.streak = d.vocab.lastDay === yesterday ? d.vocab.streak + 1 : 1;
      d.vocab.lastDay = day;
    });
  },

  /* ---------------- portability ---------------- */

  exportJSON() { return JSON.stringify(_read(), null, 2); },

  importJSON(text) {
    const parsed = JSON.parse(text);           // throws on bad input, caller catches
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    _write({ ...structuredClone(BLANK), ...parsed });
    return true;
  },

  reset() { _write(structuredClone(BLANK)); },
};

window.Store = Store;
