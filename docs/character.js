/* =========================================================================
   character.js — the friend you're looking at.
   An SVG portrait rig: lip-syncs to his actual voice, blinks, nods along
   while YOU talk, glances up when thinking, breathes when idle.
   Same interface as the old orb: setState(), .userLevel, .getCoachLevel().
   ========================================================================= */

const CHARACTERS = {
  blend: {   // Sterling — velvet lounge mystic
    skin: '#e9bb8d', skinShade: '#d6a276', blush: '#d98d6b',
    hair: '#2b2220', hairShine: '#4a3b35', streak: '#b9b3ad',
    brow: '#241d1a', eye: '#7a5230',
    jacket: '#4b3a86', jacketDark: '#372a66', shirt: '#efe6d8',
    accessory: 'medallion', hairStyle: 'swept', facial: 'shadow',
    browTilt: -2,
  },
  brand: {   // Vale — flamboyant poet
    skin: '#efd0b2', skinShade: '#dcb691', blush: '#dc9a7e',
    hair: '#1a1420', hairShine: '#352a44', streak: null,
    brow: '#151019', eye: '#3a2a22',
    jacket: '#5d2333', jacketDark: '#471a27', shirt: '#e8d9c8',
    accessory: 'pendant', hairStyle: 'wild', facial: 'scruff',
    browTilt: 3,
  },
  ferguson: { // Rascal — cheeky silver fox
    skin: '#dba379', skinShade: '#c68c62', blush: '#c97f5f',
    hair: '#6d7078', hairShine: '#8d9099', streak: null,
    brow: '#4a4d55', eye: '#5b7f95',
    jacket: '#33374a', jacketDark: '#262a3a', shirt: '#15161d',
    accessory: 'none', hairStyle: 'short', facial: 'goatee',
    browTilt: 0,
  },
};

const SVGNS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}, parent = null) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

// hair geometries per style: [backPath, frontPath, extraFrontPath?]
function hairPaths(style) {
  if (style === 'wild') return {
    back: 'M 96 250 C 78 150 120 74 210 70 C 300 74 342 150 324 250 C 336 300 330 356 316 386 C 306 344 300 320 296 300 C 300 250 298 220 290 196 C 262 176 168 176 130 196 C 122 220 120 250 124 300 C 120 320 114 344 104 386 C 90 356 84 300 96 250 Z',
    front: 'M 122 206 C 128 148 160 108 210 104 C 262 108 292 148 298 206 C 288 172 268 158 252 166 C 258 176 256 184 250 190 C 240 168 220 158 208 162 C 186 154 158 168 150 192 C 142 176 132 184 122 206 Z',
  };
  if (style === 'short') return {
    back: 'M 116 236 C 108 148 150 92 210 90 C 270 92 312 148 304 236 C 306 210 304 196 298 184 C 250 158 170 158 122 184 C 116 196 114 210 116 236 Z',
    front: 'M 122 196 C 136 138 168 112 210 110 C 252 112 284 138 298 196 C 284 170 262 156 238 158 C 244 166 244 172 240 178 C 226 160 200 154 184 160 C 166 164 146 178 138 198 C 132 190 126 190 122 196 Z',
  };
  // swept (Sterling)
  return {
    back: 'M 110 244 C 98 146 146 84 210 82 C 276 84 322 146 310 244 C 314 216 312 198 306 186 C 258 156 164 156 116 186 C 110 198 106 216 110 244 Z',
    front: 'M 116 202 C 126 136 162 104 212 102 C 266 106 296 142 302 198 C 292 168 274 150 246 148 C 254 160 254 170 248 178 C 234 156 204 148 182 154 C 158 160 136 178 128 202 C 124 196 120 198 116 202 Z',
    streakPath: 'M 236 150 C 252 152 268 164 278 182 C 284 194 288 204 290 214 C 282 192 268 172 250 162 C 244 156 240 152 236 150 Z',
  };
}

class Character {
  constructor(mount, personaKey = 'blend') {
    this.mount = mount;
    this.state = 'idle';
    this.userLevel = 0;
    this.getCoachLevel = () => 0;

    // animated parameters (current -> eased toward targets)
    this.p = { open: 0, smile: 0.5, browL: 0, browR: 0, lid: 0, gx: 0, gy: 0,
               bobY: 0, tilt: 0, breath: 0 };
    this._level = 0;
    this._nod = 0;            // nod phase 0..1 decaying
    this._nodCooldown = 0;
    this._blinkAt = performance.now() + 1800;
    this._blinking = 0;
    this._gazeTarget = { x: 0, y: 0 };
    this._gazeAt = 0;
    this._t = 0;

    this.build(personaKey);
    requestAnimationFrame(() => this._frame());
  }

  build(personaKey) {
    this.cfg = CHARACTERS[personaKey] || CHARACTERS.blend;
    this.uid = this.uid || ('u' + Math.floor(Math.random() * 1e9).toString(36));
    const c = this.cfg;
    this.mount.innerHTML = '';
    const svg = el('svg', { viewBox: '0 0 420 520', class: 'char-svg', 'aria-label': 'your friend' }, null);
    this.mount.appendChild(svg);

    // defs
    const defs = el('defs', {}, svg);
    const glow = el('radialGradient', { id: `cg-glow-${this.uid}`, cx: '50%', cy: '42%', r: '60%' }, defs);
    el('stop', { offset: '0%', 'stop-color': 'rgba(144,133,233,0.34)' }, glow);
    el('stop', { offset: '70%', 'stop-color': 'rgba(144,133,233,0.10)' }, glow);
    el('stop', { offset: '100%', 'stop-color': 'rgba(144,133,233,0)' }, glow);
    const skinG = el('linearGradient', { id: `cg-skin-${this.uid}`, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%', 'stop-color': c.skin }, skinG);
    el('stop', { offset: '100%', 'stop-color': c.skinShade }, skinG);
    const jackG = el('linearGradient', { id: `cg-jacket-${this.uid}`, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0%', 'stop-color': c.jacket }, jackG);
    el('stop', { offset: '100%', 'stop-color': c.jacketDark }, jackG);

    el('ellipse', { cx: 210, cy: 240, rx: 200, ry: 210, fill: `url(#cg-glow-${this.uid})` }, svg);

    /* ---------------- body ---------------- */
    const body = el('g', {}, svg);
    // neck (behind body top)
    el('path', { d: 'M 182 312 L 182 372 Q 210 388 238 372 L 238 312 Z', fill: `url(#cg-skin-${this.uid})` }, body);
    el('path', { d: 'M 182 312 Q 210 342 238 312 L 238 340 Q 210 362 182 340 Z', fill: c.skinShade, opacity: 0.55 }, body);
    // shoulders / jacket
    el('path', { d: 'M 52 520 C 58 430 108 372 170 356 L 210 380 L 250 356 C 312 372 362 430 368 520 Z',
                 fill: `url(#cg-jacket-${this.uid})` }, body);
    // shirt / chest V
    el('path', { d: 'M 170 356 L 210 380 L 250 356 L 252 402 Q 210 440 168 402 Z', fill: c.shirt }, body);
    // lapels
    el('path', { d: 'M 170 356 L 210 380 L 186 424 L 152 380 Z', fill: c.jacketDark, opacity: 0.85 }, body);
    el('path', { d: 'M 250 356 L 210 380 L 234 424 L 268 380 Z', fill: c.jacketDark, opacity: 0.85 }, body);
    if (c.accessory === 'medallion') {
      el('path', { d: 'M 196 384 Q 210 402 224 384', fill: 'none', stroke: '#d4a943', 'stroke-width': 2.4 }, body);
      el('circle', { cx: 210, cy: 404, r: 7, fill: '#d4a943', stroke: '#a97f2c', 'stroke-width': 1.6 }, body);
    } else if (c.accessory === 'pendant') {
      el('path', { d: 'M 194 382 Q 210 406 226 382', fill: 'none', stroke: '#c9ccd6', 'stroke-width': 1.8 }, body);
      el('path', { d: 'M 205 406 L 210 418 L 215 406 Z', fill: '#c9ccd6' }, body);
    }

    /* ---------------- head ---------------- */
    const hp = hairPaths(c.hairStyle);
    this.head = el('g', { class: 'char-head' }, svg);
    const H = this.head;

    el('path', { d: hp.back, fill: c.hair }, H);                       // hair back
    el('ellipse', { cx: 116, cy: 248, rx: 15, ry: 23, fill: `url(#cg-skin-${this.uid})` }, H);  // ears
    el('ellipse', { cx: 304, cy: 248, rx: 15, ry: 23, fill: `url(#cg-skin-${this.uid})` }, H);
    // face
    el('path', { d: 'M 210 118 C 268 118 300 162 300 232 C 300 290 268 342 210 344 C 152 342 120 290 120 232 C 120 162 152 118 210 118 Z',
                 fill: `url(#cg-skin-${this.uid})` }, H);
    // subtle jaw shade
    el('path', { d: 'M 150 296 C 172 330 248 330 270 296 C 254 322 166 322 150 296 Z', fill: c.skinShade, opacity: 0.5 }, H);

    // blush
    el('ellipse', { cx: 152, cy: 262, rx: 15, ry: 8, fill: c.blush, opacity: 0.28 }, H);
    el('ellipse', { cx: 268, cy: 262, rx: 15, ry: 8, fill: c.blush, opacity: 0.28 }, H);

    // eyes
    this.eyes = {};
    for (const [side, ex] of [['L', 171], ['R', 249]]) {
      const g = el('g', {}, H);
      el('ellipse', { cx: ex, cy: 228, rx: 18, ry: 12, fill: '#f7f2ea' }, g);
      const iris = el('circle', { cx: ex, cy: 229, r: 8.6, fill: c.eye }, g);
      const pupil = el('circle', { cx: ex, cy: 229, r: 4.2, fill: '#17120e' }, g);
      const spark = el('circle', { cx: ex + 2.6, cy: 226, r: 1.9, fill: '#ffffff', opacity: 0.9 }, g);
      const lid = el('ellipse', { cx: ex, cy: 228, rx: 18.6, ry: 12.6, fill: `url(#cg-skin-${this.uid})`,
                                  style: 'transform-box: fill-box; transform-origin: 50% 0%;' }, g);
      el('path', { d: `M ${ex - 18} 226 Q ${ex} 214 ${ex + 18} 226`, fill: 'none',
                   stroke: c.skinShade, 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.8 }, g);
      this.eyes[side] = { iris, pupil, spark, lid, ex };
    }

    // brows
    this.browL = el('path', { d: 'M 148 204 Q 171 194 194 202', fill: 'none', stroke: c.brow,
                              'stroke-width': 7, 'stroke-linecap': 'round',
                              style: 'transform-box: fill-box; transform-origin: 50% 50%;' }, H);
    this.browR = el('path', { d: 'M 226 202 Q 249 194 272 204', fill: 'none', stroke: c.brow,
                              'stroke-width': 7, 'stroke-linecap': 'round',
                              style: 'transform-box: fill-box; transform-origin: 50% 50%;' }, H);

    // nose
    el('path', { d: 'M 210 232 C 208 246 203 256 200 262 Q 210 270 220 262 C 217 256 212 246 210 232 Z',
                 fill: c.skinShade, opacity: 0.6 }, H);

    // facial hair (under mouth layer)
    if (c.facial === 'goatee') {
      this.facialEl = el('path', {
        d: 'M 176 292 C 182 322 238 322 244 292 C 244 316 236 334 210 336 C 184 334 176 316 176 292 Z',
        fill: '#8b8e94', opacity: 0.9 }, H);
    } else if (c.facial === 'scruff') {
      this.facialEl = el('path', {
        d: 'M 142 274 C 152 322 268 322 278 274 C 272 318 254 340 210 342 C 166 340 148 318 142 274 Z',
        fill: c.hair, opacity: 0.16 }, H);
    } else if (c.facial === 'shadow') {
      this.facialEl = el('path', {
        d: 'M 150 284 C 160 320 260 320 270 284 C 264 314 248 332 210 334 C 172 332 156 314 150 284 Z',
        fill: c.hair, opacity: 0.10 }, H);
    }

    // mouth (dynamic)
    this.mouthFill = el('path', { d: '', fill: '#57222d' }, H);
    this.tongue = el('ellipse', { cx: 210, cy: 0, rx: 12, ry: 5, fill: '#a04a52', opacity: 0 }, H);
    this.mouthLine = el('path', { d: '', fill: 'none', stroke: '#7c4a3c', 'stroke-width': 2.6,
                                  'stroke-linecap': 'round' }, H);

    // hair front (+ optional silver streak)
    el('path', { d: hp.front, fill: c.hair }, H);
    if (hp.streakPath && c.streak) el('path', { d: hp.streakPath, fill: c.streak, opacity: 0.85 }, H);
    // hair shine
    el('path', { d: hp.front, fill: c.hairShine, opacity: 0.18,
                 transform: 'translate(0,-3) scale(0.995)' }, H);
  }

  setState(s) { this.state = s; }
  setPersona(key) { this.build(key); }

  /* -------------------------- animation -------------------------- */

  _frame() {
    const now = performance.now();
    this._t += 1;
    const t = this._t;
    const p = this.p;

    // audio level (fast attack, slow release)
    const raw = this.state === 'speaking' ? this.getCoachLevel() : 0;
    this._level = raw > this._level ? this._level * 0.5 + raw * 0.5 : this._level * 0.86;
    const lv = this._level;

    // ---- targets by state ----
    let T = { open: 0, smile: 0.5, browL: 0, browR: 0, gx: 0, gy: 0.05, tilt: 0 };
    if (this.state === 'speaking') {
      const jitter = 0.16 * Math.sin(t * 0.9) * Math.max(0, lv - 0.05);
      T.open = Math.min(1, lv * 2.6 + jitter);
      T.smile = 0.45 + 0.2 * Math.sin(t * 0.013);
      const lively = 0.25 + lv * 0.9;
      T.browL = lively * (0.5 + 0.5 * Math.sin(t * 0.05));
      T.browR = lively * (0.5 + 0.5 * Math.sin(t * 0.05 + 0.9));
      T.gx = 0.12 * Math.sin(t * 0.011);
      T.tilt = 2.2 * Math.sin(t * 0.017);
    } else if (this.state === 'listening') {
      T.smile = 0.66;
      const u = Math.min(1, this.userLevel * 1.4);
      T.browL = T.browR = u * 0.55;
      // empathetic nod when the user is talking
      if (u > 0.16 && this._nodCooldown <= 0) { this._nod = 1; this._nodCooldown = 90 + Math.random() * 120; }
      T.gx = 0.05 * Math.sin(t * 0.006);
      T.tilt = 3 * Math.sin(t * 0.004) + u * 2;
    } else if (this.state === 'thinking') {
      T.smile = 0.28; T.open = 0.06;
      T.browL = -0.35; T.browR = 0.45;
      T.gx = 0.55; T.gy = -0.55;
      T.tilt = -3.5;
    } else { // idle
      T.smile = 0.5;
      if (now > this._gazeAt) {
        this._gazeTarget = { x: (Math.random() - 0.5) * 0.7, y: (Math.random() - 0.5) * 0.4 };
        this._gazeAt = now + 1600 + Math.random() * 2600;
      }
      T.gx = this._gazeTarget.x; T.gy = this._gazeTarget.y;
      T.tilt = 2 * Math.sin(t * 0.005);
      T.browL = T.browR = 0.06 * Math.sin(t * 0.008);
    }

    // ---- easing ----
    const ease = (k, target, f) => { p[k] += (target - p[k]) * f; };
    ease('open', T.open, this.state === 'speaking' ? 0.5 : 0.18);
    ease('smile', T.smile, 0.08);
    ease('browL', T.browL, 0.14);
    ease('browR', T.browR, 0.14);
    ease('gx', T.gx, 0.10);
    ease('gy', T.gy, 0.10);
    ease('tilt', T.tilt, 0.05);

    // breath + bob + nod
    p.breath = 1 + 0.011 * Math.sin(t * 0.021);
    this._nodCooldown -= 1;
    let nodY = 0;
    if (this._nod > 0.01) {
      nodY = Math.sin((1 - this._nod) * Math.PI * 2) * 6 * this._nod;
      this._nod *= 0.94;
    }
    const speakBob = this.state === 'speaking' ? lv * 3.4 * Math.sin(t * 0.35) : 0;
    p.bobY = 4 * Math.sin(t * 0.021) + nodY + speakBob;

    // blink
    if (now > this._blinkAt) { this._blinking = 1; this._blinkAt = now + 1700 + Math.random() * 3600; }
    if (this._blinking > 0) {
      this._blinking = Math.max(0, this._blinking - 0.14);
    }
    const lid = this._blinking > 0 ? Math.sin(this._blinking * Math.PI) : 0;

    /* ---- apply ---- */
    this.head.setAttribute('transform',
      `translate(0 ${p.bobY.toFixed(2)}) rotate(${p.tilt.toFixed(2)} 210 260) scale(${p.breath})`);
    this.head.style.transformOrigin = '210px 260px';

    // eyes
    const px = p.gx * 6, py = p.gy * 4.5;
    for (const side of ['L', 'R']) {
      const e = this.eyes[side];
      e.iris.setAttribute('cx', e.ex + px); e.iris.setAttribute('cy', 229 + py);
      e.pupil.setAttribute('cx', e.ex + px); e.pupil.setAttribute('cy', 229 + py);
      e.spark.setAttribute('cx', e.ex + px + 2.6); e.spark.setAttribute('cy', 226 + py);
      e.lid.style.transform = `scaleY(${lid.toFixed(3)})`;
    }

    // brows (raise = negative Y)
    const bt = this.cfg.browTilt || 0;
    this.browL.style.transform = `translateY(${(-p.browL * 8).toFixed(2)}px) rotate(${(bt - p.browL * 4).toFixed(2)}deg)`;
    this.browR.style.transform = `translateY(${(-p.browR * 8).toFixed(2)}px) rotate(${(-bt + p.browR * 4).toFixed(2)}deg)`;

    // mouth
    this._drawMouth(p.open, p.smile);

    requestAnimationFrame(() => this._frame());
  }

  _drawMouth(open, smile) {
    const cx = 210, y0 = 291;
    const half = 30 + 6 * open;
    const lift = 11 * (smile - 0.5) * 2;         // corner lift
    const cyU = y0 - 3 - 9 * open - Math.max(0, lift);   // upper lip control
    const cyD = y0 + 4 + 27 * open - Math.min(0, lift) * 0.4;  // lower lip control
    const xL = cx - half, xR = cx + half;
    const yC = y0 - lift * 0.55;                 // corner height
    const d = `M ${xL} ${yC} Q ${cx} ${cyU} ${xR} ${yC} Q ${cx} ${cyD} ${xL} ${yC} Z`;
    this.mouthFill.setAttribute('d', d);
    this.mouthFill.setAttribute('opacity', open > 0.04 ? 1 : 0);
    this.mouthLine.setAttribute('d', `M ${xL} ${yC} Q ${cx} ${y0 - 2 - lift} ${xR} ${yC}`);
    this.tongue.setAttribute('cy', y0 + 14 * open);
    this.tongue.setAttribute('opacity', open > 0.4 ? (open - 0.4) : 0);
  }
}

window.Character = Character;
