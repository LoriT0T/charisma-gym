/* =========================================================================
   evolve.js — the parts that make this an ecosystem rather than a reference
   book: a channel from real life back into the system, an engine that decides
   what you do next, and the instruments that tell you whether any of it works.

   The loop:
     call + field log  →  data  →  diagnosis  →  prescription  →  next rep
                            ↑                                        │
                            └────────────── measured ────────────────┘

   Three components close it:
     Field   — the only input from reality. Everything else is simulation.
     Lab     — turns practice into personal evidence; confirmed results
               graduate into a playbook that is yours, not generic advice.
     Signals — instruments. Trends, calibration, and the weekly review.
   ========================================================================= */

/* Rubric dimension → what to actually do about it. The analyzer already scores
   these six on every call; without this map that signal has nowhere to go. */
const PRESCRIPTIONS = {
  energy: {
    label: 'Energy & vividness',
    drill: 'Back row projection, then over-articulation — warm up module.',
    move: 'Full-Body Broadcasting: swing your pitch and pace deliberately for one story.',
    field: 'Tell one story today with your whole instrument. Do a voice.',
  },
  wit: {
    label: 'Wit & playfulness',
    drill: 'Words module — the upgrade pairs. Vivid beats accurate for wit.',
    move: 'The Non-Literal Answer: take the silly reading of one question today.',
    field: 'Answer one question playfully instead of literally.',
  },
  curiosity: {
    label: 'Curiosity & other-focus',
    drill: 'Playbook — the golden thread and the echo.',
    move: 'The Second Question: chase the person, not the topic.',
    field: 'Ask one real follow-up where you would normally switch topic.',
  },
  story: {
    label: 'Storytelling & disclosure',
    drill: 'Playbook — the seven-part story structure. Try the false ending.',
    move: 'Flaws on the Table: volunteer your own worst material first, with amusement.',
    field: 'Answer one "how was your weekend" with a 30-second story.',
  },
  confidence: {
    label: 'Confidence markers',
    drill: 'Warm up — slow, unhurried passages. Rushing is the tell.',
    move: 'The Awkward Pause: say something, then hold it for two beats.',
    field: 'Cut one hedge today. No "kind of", no "I think maybe".',
  },
  presence: {
    label: 'Presence & responsiveness',
    drill: 'Playbook — callbacks and Naming the Room.',
    move: 'The Callback Trophy: reuse one of their odd phrases later in the talk.',
    field: 'Land one callback to something said earlier in the conversation.',
  },
};

const OUTCOMES = [
  { v: 1, label: 'Went badly' },
  { v: 2, label: 'Flat' },
  { v: 3, label: 'Fine' },
  { v: 4, label: 'Good' },
  { v: 5, label: 'Really good' },
];

/* ---------------------------------------------------------------------------
   COACH — the prescription engine.
   Ordered rules, first match wins. Every branch returns one concrete action,
   never a list, because a list is a decision you have pushed back onto him.
   --------------------------------------------------------------------------- */

const Coach = {
  nextRep() {
    const calls = Store.calls();
    const field7 = Store.field(7);
    const cal = Store.calibration();
    const running = Store.all().experiments.filter((x) => x.status === 'running');
    const sinceReview = Store.daysSinceReview();
    const reps = Store.repsThisWeek();

    // 1. No baseline yet — everything downstream needs scored turns.
    if (!calls.length) {
      return {
        why: 'No baseline yet',
        what: 'Make one call. The analyzer scores six dimensions while you talk, and every prescription after this is derived from those scores.',
        go: 'call', cta: 'Call a friend',
      };
    }

    // 2. Reality has gone dark. Simulation without field data is a closed loop
    //    that cannot detect its own drift — this is the highest-priority gap.
    if (!field7.length) {
      return {
        why: 'No real-world data in 7 days',
        what: 'Log one real interaction. The calls are practice; the field log is the only thing that tells us whether any of it transferred.',
        go: 'field', cta: 'Log an interaction',
      };
    }

    // 3. Under-attempting. Volume is the one input fully under his control.
    if (reps < 3) {
      return {
        why: `Only ${reps} rep${reps === 1 ? '' : 's'} this week`,
        what: 'Chemistry is partly luck; attempts are not. Start one conversation today and log it, whatever happens.',
        go: 'field', cta: 'Go get a rep',
      };
    }

    // 4. Calibration is badly off — expecting worse than reality suppresses
    //    attempts, so it is worth fixing before technique.
    if (cal && cal.n >= 5 && cal.bias > 0.8) {
      return {
        why: 'You systematically expect these to go worse than they do',
        what: `Across ${cal.n} logged interactions you under-predicted by ${cal.bias.toFixed(1)} points on average. The forecast, not the skill, is what is holding down your rep count. Predict before the next one and check yourself.`,
        go: 'signals', cta: 'See your calibration',
      };
    }

    // 5. A running experiment starved of reps.
    const starved = running.find((x) => x.reps < (x.target || 5));
    if (starved) {
      return {
        why: 'Experiment still open',
        what: `"${starved.hypothesis}" — ${starved.reps} of ${starved.target || 5} reps. An unresolved experiment is not evidence yet.`,
        go: 'lab', cta: 'Add a rep to it',
      };
    }

    // 6. Weakest dimension gets targeted work.
    const weak = Store.weakestDimension();
    if (weak) {
      const [key, score] = weak;
      const p = PRESCRIPTIONS[key];
      if (p) {
        return {
          why: `${p.label} is your weakest dimension (${score}/100)`,
          what: p.field,
          detail: `${p.move}  ·  Drill: ${p.drill}`,
          go: 'field', cta: 'Try it, then log it',
        };
      }
    }

    // 7. The loop has not been closed in a week.
    if (sinceReview === null || sinceReview >= 7) {
      return {
        why: 'No review in the last week',
        what: 'Read your own instruments and decide one thing to change. A system that never reviews itself is just a habit.',
        go: 'signals', cta: 'Run the weekly review',
      };
    }

    return {
      why: 'Everything is current',
      what: 'Pick the thing you least want to do. That is usually the signal.',
      go: 'hub', cta: 'Your call',
    };
  },
};

/* ---------------------------------------------------------------------------
   Small chart primitives. Inline SVG, no libraries — CSP-safe and no build.
   Palette validated against surface #14162b: single-hue accent for magnitude,
   amber only as a non-adjacent highlight, diverging danger↔accent with a
   neutral midpoint. Green is never placed next to amber (protanopia ΔE 3.0).
   --------------------------------------------------------------------------- */

const Chart = {
  /** Horizontal magnitude bars. Single series, so no legend — the heading names
   *  it. The weakest bar is amber AND labelled "weakest", never colour alone.
   *  Real pixel viewBox with uniform scaling, so type never distorts. */
  dimensionBars(avg, weakestKey) {
    const rows = Object.entries(avg);
    const W = 600, ROW = 34, PAD = 6;
    const H = rows.length * ROW + PAD;
    const barX = 205, barW = W - barX - 46;
    return `
    <svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average score by dimension">
      ${rows.map(([k, v], i) => {
        const y = i * ROW + PAD;
        const isWeak = k === weakestKey;
        const fill = isWeak ? 'var(--ferguson-c)' : 'var(--accent)';
        return `
          <text x="0" y="${y + 15}" class="viz-lab">${PRESCRIPTIONS[k]?.label || k}</text>
          <rect x="${barX}" y="${y + 5}" width="${barW}" height="13" rx="4" fill="var(--grid)"></rect>
          <rect x="${barX}" y="${y + 5}" width="${Math.max(3, (v / 100) * barW)}" height="13" rx="4" fill="${fill}">
            <title>${k}: ${v} out of 100</title>
          </rect>
          <text x="${W}" y="${y + 15}" class="viz-val" text-anchor="end">${v}</text>
          ${isWeak ? `<text x="${barX + Math.max(3, (v / 100) * barW) + 8}" y="${y + 15}" class="viz-flag">weakest</text>` : ''}`;
      }).join('')}
    </svg>`;
  },

  /** Reps per week. Single hue, rounded ends on the baseline, 2px gaps,
   *  only the latest value direct-labelled. */
  repsBars(weeks) {
    const max = Math.max(4, ...weeks.map((w) => w.n));
    const W = 600, H = 120, BASE = H - 22, n = weeks.length;
    const bw = (W - (n - 1) * 6) / n;
    return `
    <svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Reps per week, last ${n} weeks">
      <line x1="0" y1="${BASE}" x2="${W}" y2="${BASE}" stroke="var(--grid)" stroke-width="1"></line>
      ${weeks.map((w, i) => {
        const h = Math.max(2, (w.n / max) * (BASE - 10));
        const x = i * (bw + 6);
        return `<rect x="${x}" y="${BASE - h}" width="${bw}" height="${h}" rx="4"
                      fill="var(--accent)" opacity="${i === n - 1 ? 1 : 0.5}">
                  <title>${w.label}: ${w.n} reps</title>
                </rect>`;
      }).join('')}
      <text x="0" y="${H - 4}" class="viz-lab">${n} weeks</text>
      <text x="${W}" y="${H - 4}" class="viz-val" text-anchor="end">${weeks[n - 1].n} this week</text>
    </svg>`;
  },

  /** Calibration bias — polarity, so diverging: two hues around a neutral
   *  midpoint. The direction is also stated in words below the chart. */
  biasMeter(bias) {
    const clamped = Math.max(-2, Math.min(2, bias));
    const W = 600, H = 64, MID = W / 2, SPAN = W / 2 - 30;
    const x = MID + (clamped / 2) * SPAN;
    const pos = clamped >= 0;
    return `
    <svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Prediction bias">
      <rect x="10" y="22" width="${W - 20}" height="10" rx="5" fill="var(--grid)"></rect>
      <rect x="${Math.min(MID, x)}" y="22" width="${Math.abs(x - MID)}" height="10" rx="5"
            fill="${pos ? 'var(--accent)' : 'var(--danger)'}"></rect>
      <line x1="${MID}" y1="14" x2="${MID}" y2="40" stroke="var(--text-muted)" stroke-width="1.5"></line>
      <circle cx="${x}" cy="27" r="8" fill="${pos ? 'var(--accent)' : 'var(--danger)'}"
              stroke="var(--surface-1)" stroke-width="3"><title>bias ${bias.toFixed(2)}</title></circle>
      <text x="10" y="56" class="viz-lab">expects worse than reality</text>
      <text x="${MID}" y="56" class="viz-val" text-anchor="middle">accurate</text>
      <text x="${W - 10}" y="56" class="viz-lab" text-anchor="end">expects better</text>
    </svg>`;
  },
};

/* ---------------------------------------------------------------------------
   Module renderers. Attached onto Gym so routing stays in one place.
   --------------------------------------------------------------------------- */

const Evolve = {

  /* ============================== FIELD ============================== */

  renderField() {
    const entries = Store.field();
    const cal = Store.calibration();
    const moves = Evolve.techniqueOptions();

    byId('mod-field').innerHTML = `
      <div class="wrap">
        ${Gym.head('📓', 'Field log', 'The only channel from real life back into this system. Calls are practice; this is the measurement. Log it whether it went well or not — especially when it did not.')}

        <div class="panel run-panel">
          <h3>Log an interaction</h3>
          <p class="fine">Predict first, then rate it. The gap between the two is trainable and usually more limiting than technique.</p>

          <label class="f-lab">Before it happened, I expected it to go…</label>
          <div class="opt-row" id="pred-row">
            ${OUTCOMES.map((o) => `<button class="opt" data-pred="${o.v}">${o.v} · ${o.label}</button>`).join('')}
          </div>

          <label class="f-lab">What actually happened</label>
          <div class="opt-row" id="out-row">
            ${OUTCOMES.map((o) => `<button class="opt" data-out="${o.v}">${o.v} · ${o.label}</button>`).join('')}
          </div>

          <label class="f-lab" for="f-tech">The move I tried</label>
          <select id="f-tech" class="f-select">
            <option value="">— none in particular —</option>
            ${moves.map((m) => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
          </select>

          <label class="f-lab" for="f-ctx">Where / who</label>
          <input id="f-ctx" class="f-input" placeholder="seminar, coffee shop, cousin's wedding…" />

          <label class="f-lab" for="f-note">What happened, and what you avoided</label>
          <textarea id="f-note" class="f-area" placeholder="The avoided thing is the useful half. What did you almost say and swallow?"></textarea>

          <div class="row-btns">
            <button class="btn btn-primary btn-pill" id="f-save">Log it</button>
          </div>
        </div>

        ${cal && cal.n >= 3 ? `
          <div class="panel">
            <h3>Calibration <span class="chip-mini">${cal.n} predictions</span></h3>
            ${Chart.biasMeter(cal.bias)}
            <p class="key-line">${escHtml(Evolve.biasSentence(cal))}</p>
            <p class="fine">Mean absolute error ${cal.error.toFixed(2)} points on a 5-point scale. This matters because a pessimistic forecast suppresses attempts, and attempts are the input that actually moves the outcome.</p>
          </div>` : ''}

        <div class="panel">
          <h3>History <span class="chip-mini">${entries.length}</span></h3>
          ${entries.length ? `
            <div class="table-wrap">
              <table class="history-table">
                <thead><tr><th>Day</th><th>Where</th><th>Move</th><th>Pred</th><th>Actual</th></tr></thead>
                <tbody>
                  ${entries.slice(0, 60).map((f) => `
                    <tr>
                      <td>${escHtml(f.day)}</td>
                      <td>${escHtml(f.context || '—')}</td>
                      <td>${escHtml(f.technique || '—')}</td>
                      <td>${f.predicted ?? '—'}</td>
                      <td><strong>${f.outcome ?? '—'}</strong></td>
                    </tr>
                    ${f.note ? `<tr class="note-row"><td></td><td colspan="4" class="fine">${escHtml(f.note)}</td></tr>` : ''}
                  `).join('')}
                </tbody>
              </table>
            </div>`
          : '<p class="fine">Empty. One entry — even a bad one — is worth more to this system than an hour of reading it.</p>'}
        </div>
      </div>`;

    let predicted = null, outcome = null;
    const pick = (row, attr, set) => {
      byId(row).querySelectorAll('.opt').forEach((b) => {
        b.onclick = () => {
          byId(row).querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === b));
          set(Number(b.dataset[attr]));
        };
      });
    };
    pick('pred-row', 'pred', (v) => { predicted = v; });
    pick('out-row', 'out', (v) => { outcome = v; });

    byId('f-save').onclick = () => {
      if (outcome == null) { toast('Rate how it actually went first.', true); return; }
      Store.logField({
        predicted, outcome,
        technique: byId('f-tech').value || null,
        context: byId('f-ctx').value.trim(),
        note: byId('f-note').value.trim(),
      });
      // any open experiment matching this move gets a rep automatically
      const t = byId('f-tech').value;
      if (t) {
        Store.all().experiments
          .filter((x) => x.status === 'running' && x.technique === t)
          .forEach((x) => Store.tickExperiment(x.id));
      }
      toast('Logged. That is the data this whole system runs on.');
      Evolve.renderField();
    };
  },

  biasSentence(cal) {
    const b = cal.bias;
    if (b > 0.8)  return `You expect these to go worse than they do, by ${b.toFixed(1)} points on average. Your forecast is the bottleneck, not your skill — it is quietly costing you attempts.`;
    if (b < -0.8) return `You expect these to go better than they do, by ${Math.abs(b).toFixed(1)} points. Worth checking what you are reading as interest that is only politeness.`;
    return `Your predictions track reality closely (bias ${b >= 0 ? '+' : ''}${b.toFixed(1)}). Trust your read — and note that this is rarer than it sounds.`;
  },

  techniqueOptions() {
    const r = READ_CONTENT;
    const local = [
      ...r.CONVO_MOVES.map((m) => m.name),
      ...r.WARMTH_MOVES.map((m) => m.name),
      ...r.STORY_STRUCTURE.map((s) => `Story: ${s.part}`),
    ];
    const fromCall = window.App?.cfg?.techniques ? Object.keys(App.cfg.techniques) : [];
    return [...new Set([...fromCall, ...local])];
  },

  /* =============================== LAB =============================== */

  renderLab() {
    const d = Store.all();
    const running = d.experiments.filter((x) => x.status === 'running');
    const done = d.experiments.filter((x) => x.status === 'done');
    const moves = Evolve.techniqueOptions();

    byId('mod-lab').innerHTML = `
      <div class="wrap">
        ${Gym.head('🧪', 'Lab', 'Practice becomes knowledge only when it is falsifiable. State what you think will happen, run it a fixed number of times, then rule. Confirmed results graduate into a playbook that is yours rather than generic.')}

        <div class="panel run-panel">
          <h3>New experiment</h3>
          <label class="f-lab" for="x-hyp">Hypothesis — something that could turn out false</label>
          <input id="x-hyp" class="f-input" placeholder="Opening with a preface gets people to open up faster than a normal question" />
          <div class="two-col">
            <div>
              <label class="f-lab" for="x-tech">Move under test</label>
              <select id="x-tech" class="f-select">
                <option value="">— pick one —</option>
                ${moves.map((m) => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="f-lab" for="x-target">Reps before ruling</label>
              <input id="x-target" class="f-input" type="number" min="3" max="30" value="5" />
            </div>
          </div>
          <p class="fine">Three reps is the floor. Below that you are reading noise — which is exactly how people conclude that a technique "does not work for them".</p>
          <div class="row-btns"><button class="btn btn-primary btn-pill" id="x-add">Start it</button></div>
        </div>

        <div class="panel">
          <h3>Running <span class="chip-mini">${running.length}</span></h3>
          ${running.length ? running.map((x) => `
            <div class="exp">
              <div class="exp-top">
                <strong>${escHtml(x.hypothesis)}</strong>
                <span class="chip-mini">${x.reps}/${x.target || 5}</span>
              </div>
              <div class="fine">${escHtml(x.technique || 'no move set')} · started ${escHtml(x.started)}</div>
              <div class="exp-bar"><div class="exp-fill" style="width:${Math.min(100, (x.reps / (x.target || 5)) * 100)}%"></div></div>
              <div class="row-btns">
                <button class="btn btn-mini" data-tick="${x.id}">+1 rep</button>
                <button class="btn btn-mini" data-res="${x.id}" data-v="works">Ruling: it works</button>
                <button class="btn btn-mini" data-res="${x.id}" data-v="no">Ruling: it doesn't</button>
                <button class="btn btn-mini" data-res="${x.id}" data-v="unclear">Unclear</button>
              </div>
            </div>`).join('')
          : '<p class="fine">Nothing running. Logging a field entry with a matching move auto-counts a rep, so start one and the counting takes care of itself.</p>'}
        </div>

        <div class="panel">
          <h3>Your playbook <span class="chip-mini">${d.playbook.length}</span></h3>
          <p class="fine">Moves you personally confirmed. This section is the point of the whole app — over time it should replace the generic library, because evidence about you beats advice about people in general.</p>
          ${d.playbook.length ? d.playbook.map((p) => `
            <div class="pb">
              <div class="pb-move">${escHtml(p.move)}</div>
              <div class="fine">${escHtml(p.technique || '')} · ${p.reps} reps · confirmed ${escHtml(p.provenOn)}</div>
              ${p.note ? `<div class="pb-note">${escHtml(p.note)}</div>` : ''}
            </div>`).join('')
          : '<p class="fine">Empty until an experiment returns "it works".</p>'}
        </div>

        ${done.length ? `
          <div class="panel">
            <h3>Ruled on <span class="chip-mini">${done.length}</span></h3>
            ${done.map((x) => `
              <div class="exp done">
                <div class="exp-top">
                  <span class="tier tier-${x.verdict === 'works' ? 'solid' : x.verdict === 'no' ? 'myth' : 'weak'}">${escHtml(x.verdict)}</span>
                  <strong>${escHtml(x.hypothesis)}</strong>
                </div>
                <div class="fine">${x.reps} reps · ${escHtml(x.started)} → ${escHtml(x.ended || '')}</div>
                ${x.note ? `<div class="fine">${escHtml(x.note)}</div>` : ''}
              </div>`).join('')}
          </div>` : ''}
      </div>`;

    byId('x-add').onclick = () => {
      const h = byId('x-hyp').value.trim();
      if (!h) { toast('Write the hypothesis first.', true); return; }
      Store.addExperiment({
        hypothesis: h,
        technique: byId('x-tech').value || null,
        target: Math.max(3, Number(byId('x-target').value) || 5),
      });
      toast('Running. Now go get reps.');
      Evolve.renderLab();
    };
    const mod = byId('mod-lab');
    mod.querySelectorAll('[data-tick]').forEach((b) => {
      b.onclick = () => { Store.tickExperiment(b.dataset.tick); Evolve.renderLab(); };
    });
    mod.querySelectorAll('[data-res]').forEach((b) => {
      b.onclick = () => {
        const note = prompt('One line: what did you actually observe?') || '';
        Store.resolveExperiment(b.dataset.res, b.dataset.v, note.trim());
        toast(b.dataset.v === 'works' ? 'Graduated into your playbook.' : 'Ruled. Negative results count.');
        Evolve.renderLab();
      };
    });
  },

  /* ============================= SIGNALS ============================= */

  renderSignals() {
    const avg = Store.dimensionAverages();
    const weak = Store.weakestDimension();
    const cal = Store.calibration();
    const calls = Store.calls();
    const field = Store.field();
    const reviews = Store.reviews();
    const weeks = Evolve.weeklyReps(8);

    byId('mod-signals').innerHTML = `
      <div class="wrap">
        ${Gym.head('📈', 'Signals', 'Instruments. If the numbers here are not moving over months, the system is not working and should be changed — that judgement is the whole reason to keep records.')}

        <div class="panel">
          <h3>Reps per week</h3>
          <p class="fine">The input you control. Everything else is downstream of this one.</p>
          ${Chart.repsBars(weeks)}
        </div>

        ${avg ? `
          <div class="panel">
            <h3>Dimensions <span class="chip-mini">last ${Math.min(10, calls.length)} calls</span></h3>
            <p class="fine">Scored by the analyzer during live calls. One series, so the bars share a colour; the weakest is highlighted and labelled.</p>
            ${Chart.dimensionBars(avg, weak?.[0])}
            ${weak ? `<p class="key-line">Weakest: ${escHtml(PRESCRIPTIONS[weak[0]]?.label || weak[0])} at ${weak[1]}/100. ${escHtml(PRESCRIPTIONS[weak[0]]?.move || '')}</p>` : ''}
          </div>`
        : `<div class="panel"><h3>Dimensions</h3><p class="fine">No scored calls yet. Make a call and the six dimensions appear here.</p></div>`}

        ${cal && cal.n >= 3 ? `
          <div class="panel">
            <h3>Calibration <span class="chip-mini">${cal.n} predictions</span></h3>
            ${Chart.biasMeter(cal.bias)}
            <p class="key-line">${escHtml(Evolve.biasSentence(cal))}</p>
          </div>` : ''}

        <div class="panel">
          <h3>Totals</h3>
          <div class="stat-strip">
            ${Gym.statTile(calls.length, 'calls')}
            ${Gym.statTile(field.length, 'field entries')}
            ${Gym.statTile(Store.learnedList().length, 'words locked in')}
            ${Gym.statTile(Math.round(Store.drillSeconds() / 60), 'minutes drilled')}
            ${Gym.statTile(Store.all().playbook.length, 'moves proven')}
          </div>
        </div>

        <div class="panel run-panel">
          <h3>Weekly review</h3>
          <p class="fine">Read the instruments above, then write one thing you will change. A system that never reviews itself is just a habit with extra steps.</p>
          <div class="review-auto">${Evolve.autoSummary(weeks, avg, weak, cal, field)}</div>
          <textarea id="rv-note" class="f-area" placeholder="What the data says, and the one thing I am changing this week."></textarea>
          <div class="row-btns"><button class="btn btn-primary btn-pill" id="rv-save">Close the loop</button></div>
        </div>

        ${reviews.length ? `
          <div class="panel">
            <h3>Past reviews <span class="chip-mini">${reviews.length}</span></h3>
            ${reviews.slice(0, 12).map((r) => `
              <div class="ev">
                <div class="ev-day">${escHtml(r.day)}</div>
                <div class="ev-body"><div class="ev-text">${escHtml(r.text)}</div>
                <div class="fine">${escHtml(r.snapshot || '')}</div></div>
              </div>`).join('')}
          </div>` : ''}
      </div>`;

    byId('rv-save').onclick = () => {
      const t = byId('rv-note').value.trim();
      if (!t) { toast('Write the one thing you are changing.', true); return; }
      Store.addReview(t, `${Store.repsThisWeek()} reps · ${calls.length} calls · ${field.length} field`);
      toast('Loop closed.');
      Evolve.renderSignals();
    };
  },

  weeklyReps(n) {
    const out = [];
    for (let w = n - 1; w >= 0; w--) {
      const end = Date.now() - w * 7 * 86400000;
      const start = end - 7 * 86400000;
      const count = Store.all().events.filter(
        (e) => e.type === 'rep' && e.at > start && e.at <= end).length;
      out.push({ n: count, label: w === 0 ? 'this week' : `${w}w ago` });
    }
    return out;
  },

  autoSummary(weeks, avg, weak, cal, field) {
    const bits = [];
    const now = weeks[weeks.length - 1].n, prev = weeks[weeks.length - 2]?.n ?? 0;
    bits.push(`${now} reps this week${prev ? ` (${now >= prev ? '+' : ''}${now - prev} vs last)` : ''}.`);
    if (weak) bits.push(`Weakest dimension: ${PRESCRIPTIONS[weak[0]]?.label || weak[0]} at ${weak[1]}.`);
    if (cal && cal.n >= 3) bits.push(`Prediction bias ${cal.bias >= 0 ? '+' : ''}${cal.bias.toFixed(1)}.`);
    const withNotes = field.filter((f) => f.note);
    if (withNotes.length) bits.push(`${withNotes.length} field notes to re-read.`);
    if (!field.length) bits.push('No field entries — the loop is open.');
    return bits.join(' ');
  },
};

window.Coach = Coach;
window.Chart = Chart;
window.Evolve = Evolve;
window.PRESCRIPTIONS = PRESCRIPTIONS;
