/* =========================================================================
   hud.js — "the booth": stat tile, six dimension meters, tips feed,
   transcript, history table, and a tiny markdown renderer for the debrief.
   ========================================================================= */

const HUD = {
  rubric: {},           // key -> label (from /api/config)
  history: [],          // feedback payloads in order
  fillerTotal: 0,

  init(rubric) {
    this.rubric = rubric;
    const meters = document.getElementById('meters');
    meters.innerHTML = '';
    for (const [key, label] of Object.entries(rubric)) {
      const row = document.createElement('div');
      row.className = 'meter';
      row.innerHTML = `
        <div class="meter-name">${label}</div>
        <div class="meter-track"><div class="meter-fill" id="meter-${key}"></div></div>
        <div class="meter-val" id="meterval-${key}">–</div>`;
      meters.appendChild(row);
    }
  },

  addFeedback(fb) {
    this.history.push(fb);
    this.fillerTotal += fb.filler_count || 0;

    // meters show the latest turn
    for (const [key, val] of Object.entries(fb.scores)) {
      const fill = document.getElementById(`meter-${key}`);
      const num = document.getElementById(`meterval-${key}`);
      if (fill) fill.style.width = `${val}%`;
      if (num) num.textContent = val;
    }

    // stat tile: session average + delta vs previous turn
    const avg = Math.round(this.history.reduce((s, f) => s + f.overall, 0) / this.history.length);
    document.getElementById('overall-value').textContent = avg;
    const deltaEl = document.getElementById('overall-delta');
    if (this.history.length > 1) {
      const d = fb.overall - this.history[this.history.length - 2].overall;
      deltaEl.textContent = d === 0 ? '±0' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}`;
      deltaEl.className = `stat-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`;
      deltaEl.title = 'vs your previous turn';
    }
    document.getElementById('turns-analyzed').textContent =
      `${this.history.length} turn${this.history.length === 1 ? '' : 's'} analyzed`;
    document.getElementById('filler-total').textContent = `${this.fillerTotal} fillers`;
    this._spark();

    // tip card
    const feed = document.getElementById('feed');
    const empty = feed.querySelector('.feed-empty');
    if (empty) empty.remove();
    const src = ['brand', 'ferguson', 'field'].includes(fb.tip.source) ? fb.tip.source : 'ferguson';
    const card = document.createElement('div');
    card.className = `tip-card src-${src}`;
    const pulled = fb.pulled_off
      ? `<div class="tip-pulled">✓ You pulled off <b>${esc(fb.pulled_off)}</b></div>` : '';
    const friend = fb.friend
      ? `<div class="tip-friend">Their move: <b>${esc(fb.friend.technique)}</b>${
          fb.friend.note ? ' — ' + esc(fb.friend.note) : ''}</div>` : '';
    card.innerHTML = `
      <div class="tip-top">
        <span class="tip-badge">${src.toUpperCase()}</span>
        <span class="tip-technique">${esc(fb.tip.technique)}</span>
        <span class="tip-score">${fb.overall}</span>
      </div>
      <div class="tip-text">${esc(fb.tip.text)}</div>
      <div class="tip-strength"><b>Landed:</b> ${esc(fb.strength)}</div>${pulled}${friend}`;
    feed.prepend(card);
    while (feed.children.length > 24) feed.lastChild.remove();

    // history table row
    const tbody = document.querySelector('#history-table tbody');
    document.getElementById('history-empty').classList.add('hidden');
    const tr = document.createElement('tr');
    const s = fb.scores;
    tr.innerHTML = `
      <td title="${esc(fb.turn_text)}">${esc(fb.turn_text)}</td>
      <td>${s.energy}</td><td>${s.wit}</td><td>${s.curiosity}</td>
      <td>${s.story}</td><td>${s.confidence}</td><td>${s.presence}</td>
      <td><strong>${fb.overall}</strong></td>`;
    tbody.appendChild(tr);
  },

  _spark() {
    const svg = document.getElementById('spark');
    const pts = this.history.slice(-12).map((f) => f.overall);
    if (pts.length < 2) { svg.innerHTML = ''; return; }
    const W = 120, H = 36, pad = 3;
    const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
    const y = (v) => H - pad - (v / 100) * (H - pad * 2);
    let d = `M ${x(0)} ${y(pts[0])}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${x(i)} ${y(pts[i])}`;
    const lastX = x(pts.length - 1), lastY = y(pts[pts.length - 1]);
    svg.innerHTML = `
      <path d="${d}" fill="none" stroke="rgba(144,133,233,0.45)" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastX}" cy="${lastY}" r="3.4" fill="#9085e9" stroke="#14162b" stroke-width="2"/>`;
  },

  addTranscript(role, text) {
    const wrap = document.getElementById('transcript');
    const empty = wrap.querySelector('.feed-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = `t-line ${role === 'user' ? 't-user' : 't-coach'}`;
    div.innerHTML = `<span class="t-who">${role === 'user' ? 'YOU' : esc(window.__coachName || 'COACH')}</span>${esc(text)}`;
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  },

  exportState() {
    return this.history;
  },
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- minimal markdown → HTML (headings, bold/italic, lists,
              tables, blockquotes, paragraphs) for the debrief ---------- */
function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let list = null;   // 'ul' | 'ol'
  let table = null;  // collected rows
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    out.push('<table><thead><tr>' + head.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>');
    for (const r of rows) out.push('<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>');
    out.push('</tbody></table>');
    table = null;
  };
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      if (cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/&[a-z]+;/g, '')))) continue; // separator row
      closeList();
      (table = table || []).push(cells);
      continue;
    }
    closeTable();
    if (/^###\s+/.test(line)) { closeList(); out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`); }
    else if (/^##\s+/.test(line)) { closeList(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); }
    else if (/^#\s+/.test(line)) { closeList(); out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`); }
    else if (/^\s*[-*]\s+/.test(line)) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
    } else if (/^>\s?/.test(line)) {
      closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList(); out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList(); closeTable();
  return out.join('\n');
}

window.HUD = HUD;
window.renderMarkdown = renderMarkdown;
