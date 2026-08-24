/* =========================================================================
   gym.js — the hub, the router, and the training modules.

   The voice call is one module among several now. Everything else here is
   offline practice: articulation, vocabulary, reading people, warmth and
   standards, identity. Content lives in content-voice.js / content-read.js;
   progress lives in store.js. This file is wiring and rendering only.
   ========================================================================= */

const V = () => window.VOICE_CONTENT;
const R = () => window.READ_CONTENT;
const byId = (id) => document.getElementById(id);
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MODULES = [
  { id: 'call',     icon: '🎙️', name: 'Call a friend',      blurb: 'Live voice conversation with Sterling, Vale or Rascal. Scored as you talk.' },
  { id: 'warmup',   icon: '👄', name: 'Warm up',            blurb: 'Articulators, consonant drills, tongue twisters, passages under load.' },
  { id: 'vocab',    icon: '📖', name: 'Words',              blurb: 'Kill "very big". Build range. Spaced repetition, and a log of what stuck.' },
  { id: 'identity', icon: '🧭', name: 'Identity',           blurb: 'Behaviour → evidence → identity. Pick who you are becoming and log the proof.' },
  { id: 'warmth',   icon: '🔥', name: 'Warmth & standards', blurb: 'What "hot and cold" is actually pointing at, and why the manipulative version fails.' },
  { id: 'body',     icon: '👁️', name: 'Read the room',      blurb: 'Cues that survive scrutiny, how you carry yourself, and the myths to drop.' },
  { id: 'playbook', icon: '📐', name: 'Playbook',           blurb: 'The mechanisms underneath everything: the staircase, the ratchet, storytelling.' },
  { id: 'field',    icon: '📓', name: 'Field log',          blurb: 'Log real interactions. The only channel from actual life back into the system.' },
  { id: 'lab',      icon: '🧪', name: 'Lab',                blurb: 'Run experiments on yourself. Confirmed results graduate into your own playbook.' },
  { id: 'signals',  icon: '📈', name: 'Signals',            blurb: 'Trends, calibration, and the weekly review that closes the loop.' },
];

const Gym = {
  current: 'hub',

  boot() {
    this.renderNav();
    this.renderHub();
    window.addEventListener('hashchange', () => this.routeFromHash());
    this.routeFromHash();
  },

  routeFromHash() {
    const want = (location.hash || '#hub').slice(1);
    this.go(want, true);
  },

  go(id, fromHash) {
    // leaving the call view: restore the nav and tear the stage down
    document.body.classList.remove('in-call');
    const app = byId('app');
    if (app && !app.classList.contains('hidden')) {
      app.classList.add('hidden');
      if (window.App && App.live) { try { endSession(false); } catch {} }
    }
    if (id === 'call') {
      // hand off to the existing call setup screen
      document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
      byId('setup').classList.remove('hidden');
      this.current = 'call';
      if (!fromHash) location.hash = 'call';
      this.markNav('call');
      return;
    }
    byId('setup').classList.add('hidden');
    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));

    const target = byId(id === 'hub' ? 'hub' : `mod-${id}`);
    if (!target) { location.hash = 'hub'; return; }
    target.classList.remove('hidden');
    target.scrollTop = 0;
    this.current = id;
    if (!fromHash) location.hash = id;
    this.markNav(id);

    const painter = {
      warmup:   () => this.renderWarmup(),
      vocab:    () => this.renderVocab(),
      body:     () => this.renderBody(),
      warmth:   () => this.renderWarmth(),
      identity: () => this.renderIdentity(),
      playbook: () => this.renderPlaybook(),
      field:    () => Evolve.renderField(),
      lab:      () => Evolve.renderLab(),
      signals:  () => Evolve.renderSignals(),
      hub:      () => this.renderHub(),
    }[id];
    if (painter) painter();
  },

  markNav(id) {
    document.querySelectorAll('.navlink').forEach((a) =>
      a.classList.toggle('active', a.dataset.go === id));
  },

  renderNav() {
    byId('gym-nav').innerHTML = `
      <a class="brand-inline navhome" data-go="hub" href="#hub">
        <span class="brand-name">Charisma <em>Gym</em></span>
      </a>
      <nav class="navlinks">
        ${MODULES.map((m) => `
          <a class="navlink" data-go="${m.id}" href="#${m.id}" title="${escHtml(m.blurb)}">
            <span class="navicon">${m.icon}</span><span class="navname">${escHtml(m.name)}</span>
          </a>`).join('')}
      </nav>`;
  },

  /* ============================== HUB ============================== */

  renderHub() {
    const s = Store.all();
    const learned = Store.learnedList().length;
    const reps = Store.repsThisWeek();
    const mins = Math.round(Store.drillSeconds() / 60);
    const ev = s.identity.evidence.length;
    const rx = Coach.nextRep();

    byId('hub').innerHTML = `
      <div class="wrap">
        <header class="hub-head">
          <h1>Charisma <em>Gym</em></h1>
          <p class="sub">A gym for the way you talk, read a room, and carry yourself.<br/>
          Pick something and do one rep. Reading this page is not a rep.</p>
        </header>

        <div class="stat-strip">
          ${this.statTile(Store.streak(), 'day streak')}
          ${this.statTile(reps, 'reps this week', 'attempts you controlled')}
          ${this.statTile(learned, 'words locked in')}
          ${this.statTile(mins, 'minutes drilled')}
          ${this.statTile(ev, 'identity entries')}
        </div>

        <div class="panel rx-panel">
          <div class="rx-why">${escHtml(rx.why)}</div>
          <div class="rx-what">${escHtml(rx.what)}</div>
          ${rx.detail ? `<div class="rx-detail">${escHtml(rx.detail)}</div>` : ''}
          <button class="btn btn-primary btn-pill" data-go="${rx.go}">${escHtml(rx.cta)} →</button>
        </div>

        <div class="module-grid">
          ${MODULES.map((m) => `
            <button class="module-card" data-go="${m.id}">
              <span class="mod-icon">${m.icon}</span>
              <span class="mod-name">${escHtml(m.name)}</span>
              <span class="mod-blurb">${escHtml(m.blurb)}</span>
            </button>`).join('')}
        </div>

        <div class="panel soft">
          <h3>The one rule</h3>
          <p>Every mechanism in here has the same shape: <strong>you control inputs, not outcomes.</strong>
          Chemistry is partly luck — right person, right mood, right moment. The only lever that
          reliably moves is how many honest attempts you make. So the number this app cares about
          most is <em>reps this week</em>, not how any single conversation went.</p>
          <p class="fine"><b>The unit of a rep is X&nbsp;+&nbsp;1</b>: every situation has X, the
          minimum the script requires — silence in a lift, "thanks" at a till, the expected answer
          to a friend. Do X, then add <em>one</em> small intentional thing past it. An observation,
          a real question, a named detail. Tiny on purpose: people don't remember 100%, they
          remember 101%, and the compounding is the point.</p>
          <button class="btn btn-pill" id="add-rep">+1 rep — I stepped past the script</button>
        </div>

        <div class="panel soft">
          <h3>Your data</h3>
          <p class="fine">Progress lives in this browser and <b>syncs through your Dīwān account</b> —
          every event, field entry, review, experiment and vocabulary day travels between devices
          under the same sign-in as the rest of the ecosystem, and Dīwān reads it live for the
          daily register and the weekly pulse. Nothing is kept on this app's own server, which
          wipes its disk on every rebuild; the sync is the durable copy. Export/import below is
          the manual bridge if you ever want a file in hand.</p>
          <div class="row-btns">
            <button class="btn btn-pill" id="exp-data">Export</button>
            <button class="btn btn-pill" id="imp-data">Import</button>
          </div>
          <textarea id="data-box" class="data-box hidden" spellcheck="false"></textarea>
        </div>
      </div>`;

    byId('add-rep').onclick = () => { Store.addRep(); this.renderHub(); toast('Logged. That is the only number that matters.'); };
    byId('exp-data').onclick = () => {
      const box = byId('data-box');
      box.classList.remove('hidden');
      box.value = Store.exportJSON();
      box.select();
    };
    byId('imp-data').onclick = () => {
      const box = byId('data-box');
      if (box.classList.contains('hidden')) {
        box.classList.remove('hidden'); box.value = ''; box.placeholder = 'Paste exported JSON here, then press Import again.';
        box.focus(); return;
      }
      try { Store.importJSON(box.value); this.renderHub(); toast('Imported.'); }
      catch { toast('That is not valid export data.', true); }
    };
  },

  statTile(value, label, sub) {
    return `<div class="stat-mini">
      <div class="stat-mini-v">${value}</div>
      <div class="stat-mini-l">${escHtml(label)}</div>
      ${sub ? `<div class="stat-mini-s">${escHtml(sub)}</div>` : ''}
    </div>`;
  },

  /* ============================ WARM UP ============================ */

  renderWarmup() {
    const c = V();
    const twisters = c.TWISTERS;
    byId('mod-warmup').innerHTML = `
      <div class="wrap">
        ${this.head('👄', 'Warm up', 'Loosen the articulators, drill the consonants, then run precision under load. Ten minutes before anything that matters.')}

        <div class="panel run-panel">
          <h3>Guided session</h3>
          <p class="fine">Five stages, about eight minutes. Speak out loud — silent reading trains nothing.</p>
          <div id="run-stage" class="run-stage">
            <div class="run-idle">Press start. Bring a pencil for stage five.</div>
          </div>
          <div class="row-btns">
            <button class="btn btn-primary btn-pill" id="run-start">Start session</button>
            <button class="btn btn-pill hidden" id="run-next">Next stage</button>
            <button class="btn btn-pill hidden" id="run-stop">Stop</button>
          </div>
        </div>

        <div class="panel">
          <h3>Articulator warm-up</h3>
          ${c.WARMUP.map((w) => `
            <div class="drill">
              <div class="drill-head"><strong>${escHtml(w.name)}</strong><span class="chip-mini">${w.seconds}s</span></div>
              <p class="drill-cue">${escHtml(w.cue)}</p>
              <p class="fine">${escHtml(w.why)}</p>
            </div>`).join('')}
        </div>

        <div class="panel">
          <h3>Consonant drills</h3>
          ${c.CONSONANT_DRILLS.map((d) => `
            <div class="drill">
              <div class="drill-head"><strong>${escHtml(d.name)}</strong><span class="chip-mini">${d.reps} reps</span></div>
              <p class="drill-cue">${escHtml(d.cue)}</p>
              <p class="fine">${escHtml(d.why)}</p>
            </div>`).join('')}
        </div>

        <div class="panel">
          <h3>Tongue twisters</h3>
          <p class="fine">Start slow. Every syllable clean. Speed up only while it stays sharp — the moment it smears, stop, breathe, slow down. Sloppy fast reps train sloppiness.</p>
          <div class="tw-filter">
            ${[1, 2, 3].map((lv) => `<button class="btn btn-pill tw-lv" data-lv="${lv}">Level ${lv}</button>`).join('')}
            <button class="btn btn-pill tw-lv active" data-lv="0">All</button>
          </div>
          <div id="tw-list">${this.twisterList(twisters)}</div>
        </div>

        <div class="panel">
          <h3>Passages</h3>
          <p class="fine">A twister is one hard second. A paragraph is sixty — which is where jaw fatigue and dropped word-endings actually show up.</p>
          ${c.PASSAGES.map((p) => `
            <div class="drill">
              <div class="drill-head"><strong>${escHtml(p.name)}</strong></div>
              <p class="fine">${escHtml(p.note)}</p>
              <blockquote class="passage">${escHtml(p.text)}</blockquote>
            </div>`).join('')}
        </div>

        <div class="panel">
          <h3>Under load</h3>
          <p class="fine">Same principle as a weighted bat: make the task harder, then normal speech feels effortless.</p>
          ${c.LOAD_DRILLS.map((d) => `
            <div class="drill">
              <div class="drill-head"><strong>${escHtml(d.name)}</strong></div>
              <p class="drill-cue">${escHtml(d.cue)}</p>
              <p class="fine">${escHtml(d.why)}</p>
              ${d.safety ? `<p class="fine warn">${escHtml(d.safety)}</p>` : ''}
            </div>`).join('')}
        </div>
      </div>`;

    byId('mod-warmup').querySelectorAll('.tw-lv').forEach((b) => {
      b.onclick = () => {
        byId('mod-warmup').querySelectorAll('.tw-lv').forEach((x) => x.classList.toggle('active', x === b));
        const lv = Number(b.dataset.lv);
        byId('tw-list').innerHTML = this.twisterList(lv ? twisters.filter((t) => t.level === lv) : twisters);
      };
    });
    this.wireRunner();
  },

  twisterList(list) {
    return list.map((t) => `
      <div class="tw">
        <div class="tw-meta"><span class="chip-mini">L${t.level}</span><span class="tw-focus">${escHtml(t.focus)}</span></div>
        <div class="tw-text">${escHtml(t.text)}</div>
      </div>`).join('');
  },

  /* Guided session runner — a small state machine with a countdown. */
  wireRunner() {
    const c = V();
    const stages = [
      { title: 'Stage 1 — Lip trill', seconds: 30, body: c.WARMUP[0].cue },
      { title: 'Stage 2 — Jaw release', seconds: 30, body: c.WARMUP[1].cue },
      { title: 'Stage 3 — P·T·K then B·D·G', seconds: 45, body: 'Puh Tuh Kuh × 12, then Buh Duh Guh × 12. Crisp and separated, not fast.' },
      { title: 'Stage 4 — Tongue twister', seconds: 60, body: null, pick: 'twister' },
      { title: 'Stage 5 — Pencil passage', seconds: 90, body: null, pick: 'passage' },
    ];
    let idx = -1, timer = null, remaining = 0, elapsed = 0;

    const startBtn = byId('run-start'), nextBtn = byId('run-next'), stopBtn = byId('run-stop');
    const stageBox = byId('run-stage');

    const paint = () => {
      const s = stages[idx];
      let body = s.body;
      if (s.pick === 'twister') {
        const t = c.TWISTERS[Math.floor(Math.random() * c.TWISTERS.length)];
        body = `<span class="fine">${escHtml(t.focus)}</span><div class="tw-text">${escHtml(t.text)}</div>
                <span class="fine">Slow first. Three clean passes, then speed up.</span>`;
      } else if (s.pick === 'passage') {
        const p = c.PASSAGES[Math.floor(Math.random() * c.PASSAGES.length)];
        body = `<span class="fine">Pencil between the teeth. Read it aloud, then remove and read again.</span>
                <blockquote class="passage">${escHtml(p.text)}</blockquote>`;
      } else {
        body = escHtml(body);
      }
      stageBox.innerHTML = `
        <div class="run-title">${escHtml(s.title)}</div>
        <div class="run-count" id="run-count">${remaining}</div>
        <div class="run-body">${body}</div>`;
    };

    const tick = () => {
      remaining -= 1; elapsed += 1;
      const cEl = byId('run-count');
      if (cEl) cEl.textContent = Math.max(0, remaining);
      if (remaining <= 0) { clearInterval(timer); timer = null; advance(); }
    };

    const advance = () => {
      idx += 1;
      if (idx >= stages.length) return finish();
      remaining = stages[idx].seconds;
      paint();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
    };

    const finish = () => {
      clearInterval(timer); timer = null;
      Store.logDrill('Guided warm-up', elapsed);
      stageBox.innerHTML = `<div class="run-done">Done — ${Math.round(elapsed / 60)} min logged.
        Your mouth is warm. Go use it while it lasts.</div>`;
      startBtn.classList.remove('hidden'); startBtn.textContent = 'Run it again';
      nextBtn.classList.add('hidden'); stopBtn.classList.add('hidden');
    };

    startBtn.onclick = () => {
      idx = -1; elapsed = 0;
      startBtn.classList.add('hidden');
      nextBtn.classList.remove('hidden'); stopBtn.classList.remove('hidden');
      advance();
    };
    nextBtn.onclick = () => { clearInterval(timer); timer = null; advance(); };
    stopBtn.onclick = () => {
      clearInterval(timer); timer = null;
      if (elapsed > 5) Store.logDrill('Warm-up (partial)', elapsed);
      stageBox.innerHTML = `<div class="run-idle">Stopped.</div>`;
      startBtn.classList.remove('hidden'); startBtn.textContent = 'Start session';
      nextBtn.classList.add('hidden'); stopBtn.classList.add('hidden');
    };
  },

  /* ============================== WORDS ============================== */

  renderVocab() {
    const c = V();
    const learned = Store.learnedList();
    const progress = Store.inProgressList();
    const day = Store.today();
    // deterministic daily rotation so the set is stable within a day
    const seed = [...day].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const dailyWords = rotate(c.WORDS, seed).slice(0, 5);
    const dailyUpgrades = rotate(c.UPGRADES, seed * 3).slice(0, 6);

    byId('mod-vocab').innerHTML = `
      <div class="wrap">
        ${this.head('📖', 'Words', 'Two different problems. Upgrades fix dilution — "very big" is two words doing one word\'s job. The word list builds range. Both are only useful out loud.')}

        <div class="panel">
          <h3>Today's upgrades</h3>
          <p class="fine">The intensifier is the tell. "Very", "really", "so" signal that you reached for emphasis instead of precision — one exact word beats a modifier stack every time.</p>
          <div class="upgrade-grid">
            ${dailyUpgrades.map((u) => `
              <div class="upgrade">
                <span class="up-weak">${escHtml(u.weak)}</span>
                <span class="up-arrow">→</span>
                <span class="up-strong">${u.strong.map((s) => `<em>${escHtml(s)}</em>`).join(' · ')}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="panel">
          <h3>Today's words</h3>
          <p class="fine">Chosen to be sayable this week, not to sound clever. Sounding like a thesaurus is worse than sounding plain.</p>
          <div id="card-area"></div>
          <div class="row-btns">
            <button class="btn btn-primary btn-pill" id="drill-start">Drill these ${dailyWords.length}</button>
          </div>
          <div class="word-list">
            ${dailyWords.map((w) => `
              <div class="wordrow">
                <div class="wordrow-top"><strong>${escHtml(w.word)}</strong> <span class="chip-mini">${escHtml(w.pos)}</span></div>
                <div class="wordrow-mean">${escHtml(w.meaning)}</div>
                <div class="wordrow-ex">“${escHtml(w.example)}”</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="panel">
          <h3>Locked in <span class="chip-mini">${learned.length}</span></h3>
          <p class="fine">A word counts as locked in after you recall it correctly on <strong>three separate days</strong>. Same-day repeats do not count — massed practice inflates the number without building retention.</p>
          ${progress.length ? `<div class="fine">In progress: ${progress.map((p) => `${escHtml(p.word)} (${p.hits}/3)`).join(' · ')}</div>` : ''}
          <div class="learned-wrap">
            ${learned.length
              ? learned.map((l) => `<span class="learned-chip">${escHtml(l.word)}</span>`).join('')
              : '<p class="fine">Nothing yet. Drill a set and come back tomorrow — the gap is the point.</p>'}
          </div>
        </div>

        <div class="panel">
          <h3>All upgrades <span class="chip-mini">${c.UPGRADES.length}</span></h3>
          <div class="upgrade-grid">
            ${c.UPGRADES.map((u) => `
              <div class="upgrade">
                <span class="up-weak">${escHtml(u.weak)}</span>
                <span class="up-arrow">→</span>
                <span class="up-strong">${u.strong.map((s) => `<em>${escHtml(s)}</em>`).join(' · ')}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    byId('drill-start').onclick = () => this.runWordDrill(dailyWords);
  },

  runWordDrill(words) {
    let i = 0, revealed = false;
    const area = byId('card-area');

    const paint = () => {
      if (i >= words.length) {
        area.innerHTML = `<div class="card done">Set complete. Come back tomorrow — the spacing is what makes it stick.</div>`;
        this.renderVocabSoon();
        return;
      }
      const w = words[i];
      area.innerHTML = `
        <div class="card">
          <div class="card-count">${i + 1} / ${words.length}</div>
          <div class="card-word">${escHtml(w.word)}</div>
          ${revealed ? `
            <div class="card-mean">${escHtml(w.meaning)}</div>
            <div class="card-ex">“${escHtml(w.example)}”</div>
            <div class="row-btns">
              <button class="btn btn-pill" id="c-miss">Didn't have it</button>
              <button class="btn btn-pill btn-primary" id="c-hit">Knew it</button>
            </div>`
          : `<div class="card-prompt">Say the meaning out loud, then check.</div>
             <button class="btn btn-pill btn-primary" id="c-show">Reveal</button>`}
        </div>`;

      if (revealed) {
        byId('c-hit').onclick  = () => { Store.markRecalled(w.word, true);  i++; revealed = false; paint(); };
        byId('c-miss').onclick = () => { Store.markRecalled(w.word, false); i++; revealed = false; paint(); };
      } else {
        byId('c-show').onclick = () => { Store.markSeen(w.word); revealed = true; paint(); };
      }
    };
    paint();
  },

  renderVocabSoon() { setTimeout(() => { if (this.current === 'vocab') this.renderVocab(); }, 1400); },

  /* ============================ IDENTITY ============================ */

  renderIdentity() {
    const c = R();
    const s = Store.all();
    const active = s.identity.active;

    byId('mod-identity').innerHTML = `
      <div class="wrap">
        ${this.head('🧭', 'Identity', c.IDENTITY_MODEL.principle)}

        <div class="panel">
          <h3>The loop</h3>
          <div class="loop">
            ${c.IDENTITY_MODEL.loop.map((l, n) => `
              <div class="loop-step">
                <div class="loop-n">${n + 1}</div>
                <div><strong>${escHtml(l.step)}</strong><p class="fine">${escHtml(l.text)}</p></div>
              </div>`).join('')}
          </div>
          <p class="fine warn">${escHtml(c.IDENTITY_MODEL.warning)}</p>
        </div>

        <div class="panel">
          <h3>Who are you becoming?</h3>
          <p class="fine">Pick one or two. More than that and none of them get evidence.</p>
          ${c.IDENTITY_LADDERS.map((L, n) => {
            const on = active.includes(L.identity);
            const ev = Store.evidenceFor(L.identity).length;
            return `
              <div class="ladder ${on ? 'on' : ''}">
                <button class="ladder-head" data-id="${n}">
                  <span class="ladder-check">${on ? '●' : '○'}</span>
                  <span class="ladder-name">${escHtml(L.identity)}</span>
                  ${ev ? `<span class="chip-mini">${ev} logged</span>` : ''}
                </button>
                ${on ? `
                  <div class="rungs">
                    ${L.rungs.map((r, ri) => `
                      <div class="rung">
                        <span class="rung-n">${ri + 1}</span>
                        <span class="rung-t">${escHtml(r)}</span>
                        <button class="btn btn-mini" data-log="${n}" data-rung="${ri}">Log it</button>
                      </div>`).join('')}
                    <div class="rung-free">
                      <input class="rung-input" id="free-${n}" placeholder="…or log something else you did" />
                      <button class="btn btn-mini" data-free="${n}">Log</button>
                    </div>
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>

        <div class="panel">
          <h3>Evidence file <span class="chip-mini">${s.identity.evidence.length}</span></h3>
          <p class="fine">This is not admin. This is the file your self-concept reads from — unlogged wins get forgotten, doubts never do.</p>
          ${s.identity.evidence.length ? `
            <div class="evidence">
              ${s.identity.evidence.slice(0, 40).map((e) => `
                <div class="ev">
                  <div class="ev-day">${escHtml(e.day)}</div>
                  <div class="ev-body"><div class="ev-text">${escHtml(e.text)}</div>
                  <div class="ev-id">${escHtml(e.identity)}</div></div>
                </div>`).join('')}
            </div>`
          : '<p class="fine">Empty. One entry today beats a perfect plan.</p>'}
        </div>
      </div>`;

    const mod = byId('mod-identity');
    mod.querySelectorAll('.ladder-head').forEach((b) => {
      b.onclick = () => {
        const L = c.IDENTITY_LADDERS[Number(b.dataset.id)];
        const list = Store.all().identity.active;
        const next = list.includes(L.identity)
          ? list.filter((x) => x !== L.identity)
          : [...list, L.identity];
        Store.setActiveIdentities(next);
        this.renderIdentity();
      };
    });
    mod.querySelectorAll('[data-log]').forEach((b) => {
      b.onclick = () => {
        const L = c.IDENTITY_LADDERS[Number(b.dataset.log)];
        Store.logEvidence(L.identity, L.rungs[Number(b.dataset.rung)]);
        toast('Logged. That is a brick in the wall.');
        this.renderIdentity();
      };
    });
    mod.querySelectorAll('[data-free]').forEach((b) => {
      b.onclick = () => {
        const n = Number(b.dataset.free);
        const input = byId(`free-${n}`);
        const text = (input.value || '').trim();
        if (!text) return;
        Store.logEvidence(c.IDENTITY_LADDERS[n].identity, text);
        toast('Logged.');
        this.renderIdentity();
      };
    });
  },

  /* ============================== WARMTH ============================== */

  renderWarmth() {
    const c = R();
    const M = c.WARMTH_MODEL;
    byId('mod-warmth').innerHTML = `
      <div class="wrap">
        ${this.head('🔥', 'Warmth & standards', 'What "hot and cold" is actually pointing at. The folk version says alternate warmth and withdrawal. That is wrong about the mechanism — these are two independent axes, and the position you want is high on both at once.')}

        <div class="panel">
          <h3>Two axes, not one dial</h3>
          <div class="axis-note">
            <div><strong>Warmth</strong><p class="fine">${escHtml(M.axes.warmth)}</p></div>
            <div><strong>Standards</strong><p class="fine">${escHtml(M.axes.standards)}</p></div>
          </div>
          <div class="quad">
            ${['high|low', 'high|high', 'low|low', 'low|high'].map((k) => {
              const [w, st] = k.split('|');
              const q = M.quadrants.find((x) => x.warmth === w && x.standards === st);
              const target = w === 'high' && st === 'high';
              return `<div class="quad-cell ${target ? 'target' : ''}">
                <div class="quad-name">${escHtml(q.name)}</div>
                <div class="quad-axes">warmth ${w} · standards ${st}</div>
                <div class="quad-read">${escHtml(q.reads)}</div>
              </div>`;
            }).join('')}
          </div>
          <p class="key-line">${escHtml(M.key)}</p>
        </div>

        <div class="panel">
          <h3>The moves</h3>
          ${c.WARMTH_MOVES.map((m) => `
            <div class="move">
              <div class="move-head"><strong>${escHtml(m.name)}</strong><span class="chip-mini axis-${m.axis}">${escHtml(m.axis)}</span></div>
              <p>${escHtml(m.text)}</p>
            </div>`).join('')}
        </div>

        <div class="panel danger-panel">
          <h3>${escHtml(c.ANTI_PATTERN.name)}</h3>
          <p>${escHtml(c.ANTI_PATTERN.text)}</p>
          <ul class="bullets">
            ${c.ANTI_PATTERN.consequences.map((x) => `<li>${escHtml(x)}</li>`).join('')}
          </ul>
          <p class="key-line">${escHtml(c.ANTI_PATTERN.instead)}</p>
        </div>
      </div>`;
  },

  /* =============================== BODY =============================== */

  renderBody() {
    const c = R();
    byId('mod-body').innerHTML = `
      <div class="wrap">
        ${this.head('👁️', 'Read the room', 'A single cue means almost nothing. Cues are readable only as clusters, against that person\'s baseline, and even then only as probabilities. Anyone selling a gesture dictionary is selling confident wrong answers.')}

        <div class="panel">
          <h3>Four rules that come before any cue</h3>
          ${c.BODY_PRINCIPLES.map((p) => `
            <div class="drill"><div class="drill-head"><strong>${escHtml(p.name)}</strong></div><p>${escHtml(p.text)}</p></div>`).join('')}
        </div>

        <div class="panel">
          <h3>Cues, with honest confidence</h3>
          <p class="fine">Every row carries what it is worth. Read the caveat before you act on the read.</p>
          ${c.BODY_CUES.map((x) => `
            <div class="cue">
              <div class="cue-head">
                <span class="tier tier-${x.tier}">${x.tier}</span>
                <strong>${escHtml(x.cue)}</strong>
              </div>
              <div class="cue-read">${escHtml(x.read)}</div>
              <div class="fine">⚠ ${escHtml(x.caveat)}</div>
            </div>`).join('')}
        </div>

        <div class="panel">
          <h3>How you carry yourself</h3>
          ${c.BODY_YOURS.map((b) => `
            <div class="drill"><div class="drill-head"><strong>${escHtml(b.name)}</strong></div><p>${escHtml(b.text)}</p></div>`).join('')}
        </div>

        <div class="panel danger-panel">
          <h3>Drop these — they will make you worse</h3>
          <p class="fine">Named rather than omitted, because every one of these is everywhere in this genre, and believing them hands you confident wrong answers about real people.</p>
          ${c.DEBUNKED.map((d) => `
            <div class="myth">
              <div class="myth-head"><span class="tier tier-${d.verdict}">${d.verdict}</span><strong>${escHtml(d.myth)}</strong></div>
              <div class="fine">Origin: ${escHtml(d.origin)}</div>
              <p>${escHtml(d.detail)}</p>
              <div class="instead"><strong>Instead:</strong> ${escHtml(d.instead)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  /* ============================= PLAYBOOK ============================= */

  renderPlaybook() {
    const c = R();
    byId('mod-playbook').innerHTML = `
      <div class="wrap">
        ${this.head('📐', 'Playbook', 'The mechanisms underneath every tactic in this app. Learn these eight and the tactics become derivable — which is the point, because tactics you derived are the ones you actually use.')}

        <div class="panel">
          <h3>Mechanisms</h3>
          ${c.MECHANISMS.map((m) => `
            <div class="mech">
              <div class="mech-head"><span class="tier tier-${m.tier}">${m.tier}</span><strong>${escHtml(m.name)}</strong></div>
              <div class="mech-claim">${escHtml(m.claim)}</div>
              <p>${escHtml(m.detail)}</p>
              ${m.misread ? `<div class="misread"><strong>Commonly misread:</strong> ${escHtml(m.misread)}</div>` : ''}
              <div class="apply"><strong>Do this:</strong> ${escHtml(m.apply)}</div>
              <div class="fine src">${escHtml(m.source)}</div>
            </div>`).join('')}
        </div>

        <div class="panel">
          <h3>Conversation moves</h3>
          ${c.CONVO_MOVES.map((m) => `
            <div class="drill"><div class="drill-head"><strong>${escHtml(m.name)}</strong></div><p>${escHtml(m.text)}</p></div>`).join('')}
        </div>

        <div class="panel">
          <h3>Telling a story</h3>
          <p class="fine">The highest-leverage single skill here — it is how everything else becomes visible to other people. A story communicates that you are brave or funny or self-aware without the excruciating move of saying so.</p>
          ${c.STORY_STRUCTURE.map((s, n) => `
            <div class="story-part">
              <div class="story-n">${n + 1}</div>
              <div><strong>${escHtml(s.part)}</strong><p>${escHtml(s.text)}</p></div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  head(icon, name, blurb) {
    return `<header class="mod-head">
      <div class="mod-head-icon">${icon}</div>
      <div><h2>${escHtml(name)}</h2><p class="sub">${escHtml(blurb)}</p></div>
    </header>`;
  },
};

function rotate(arr, n) {
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/* delegated navigation — works for nav links and hub cards alike */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  e.preventDefault();
  Gym.go(t.dataset.go);
});

window.Gym = Gym;
