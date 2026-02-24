const $ = (sel, root=document) => root.querySelector(sel);

const state = {
  phonemes: [],
  byKey: new Map(),
  selected: null,
  hover: null,
  showLabels: true,
};

const DIAGRAM = {
  viewBox: { w: 520, h: 360 },
  quad: {
    tl: { x: 90, y: 40 },
    tr: { x: 420, y: 40 },
    br: { x: 360, y: 300 },
    bl: { x: 150, y: 300 }
  },
  rows: {
    high: 0.08,
    nearHigh: 0.2,
    upperMid: 0.35,
    mid: 0.5,
    lowerMid: 0.62,
    nearOpen: 0.76,
    open: 0.9
  },
  cols: {
    front: 0.12,
    frontCentral: 0.3,
    central: 0.5,
    backCentral: 0.68,
    back: 0.86
  }
};

// Per-phoneme fine adjustments are stored in data/phonemes.json as slot.dx/slot.dy.


function lerp(a, b, t){
  return a + (b - a) * t;
}

function pointOnEdges(t){
  const left = {
    x: lerp(DIAGRAM.quad.tl.x, DIAGRAM.quad.bl.x, t),
    y: lerp(DIAGRAM.quad.tl.y, DIAGRAM.quad.bl.y, t)
  };
  const right = {
    x: lerp(DIAGRAM.quad.tr.x, DIAGRAM.quad.br.x, t),
    y: lerp(DIAGRAM.quad.tr.y, DIAGRAM.quad.br.y, t)
  };
  return { left, right };
}

function slotToPoint(slot = {}){
  const t = DIAGRAM.rows[slot.row] ?? 0.5;
  const u = DIAGRAM.cols[slot.col] ?? 0.5;
  const { left, right } = pointOnEdges(t);

  return {
    x: lerp(left.x, right.x, u) + (slot.dx || 0),
    y: lerp(left.y, right.y, u) + (slot.dy || 0)
  };
}

function slotFromTongueLabel(tongue = '') {
  const raw = normalizeTongueLabel(tongue);
  if (!raw) return null;

  const base = raw.split('→')[0].replace('+r', '').trim();

  if (base.startsWith('high-front')) return { row: 'high', col: 'front' };
  if (base.startsWith('high-central')) return { row: 'high', col: 'central' };
  if (base.startsWith('high-back')) return { row: 'high', col: 'back' };
  if (base.startsWith('mid-front')) return { row: 'mid', col: 'front' };
  if (base.startsWith('mid-back')) return { row: 'mid', col: 'backCentral' };
  if (base.startsWith('mid-central') || base === 'central') return { row: 'mid', col: 'central' };
  if (base.startsWith('low-front')) return { row: 'nearOpen', col: 'front' };
  if (base.startsWith('low-back')) return { row: 'nearOpen', col: 'backCentral' };
  if (base.startsWith('low-central')) return { row: 'nearOpen', col: 'central' };

  return null;
}

function resolveNodePosition(p){
  const tongueSlot = slotFromTongueLabel(p.tongue);
  if (tongueSlot) {
    const fromData = p.slot || {};
    return slotToPoint({
      ...tongueSlot,
      dx: fromData.dx || 0,
      dy: fromData.dy || 0
    });
  }

  if (p.slot?.row && p.slot?.col) return slotToPoint(p.slot);
  if (p.quad?.x != null && p.quad?.y != null) return p.quad;

  return {
    x: (p.tile?.c || 1) * 44,
    y: (p.tile?.r || 1) * 56
  };
}

function drawSlotGrid(svg){
  const g = getDiagramGuides();

  // High/Mid and Mid/Low separators
  [g.mid, g.low].forEach(({ left, right }) => {
    svg.appendChild(svgEl('line', {
      class: 'slot-grid-line',
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y
    }));
  });

  // Front/Central divider (diagonal) and Central/Back divider
  [
    [g.frontTop, g.frontBottom],
    [g.backTop, g.backBottom]
  ].forEach(([a, b]) => {
    svg.appendChild(svgEl('line', {
      class: 'slot-grid-line',
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y
    }));
  });
}

function normalizeQuery(q){
  return (q||"")
    .trim()
    .toLowerCase()
    .replace(/^\//,'')
    .replace(/\/$/,'');
}

function normalizeTongueLabel(tongue = '') {
  return String(tongue || '')
    .toLowerCase()
    .trim()
    .replace(/â†’|->/g, '→');
}

function isDiphthongLike(p = {}) {
  const t = normalizeTongueLabel(p.tongue || '');
  return t.includes('→') || String(p.type || '').toLowerCase().includes('diphthong');
}

const SEGMENT_KEY_PREFS = {
  'high-front': ['ɪ', 'i'],
  'mid-front': ['ɛ'],
  'high-back': ['ʊ', 'u'],
  'mid-back': ['ɔ'],
  'mid-central': ['ə', 'ʌ'],
  'low-front': ['ɑ', 'æ'],
  'low-back': ['ɑ2'],
  'low-central': ['ɑ']
};

const CHART_NODE_KEYS = [
  'i', 'ɪ', 'ɝ', 'ɚ', 'u', 'ʊ',
  'eɪ', 'ɛ', 'ʌ', 'ə', 'oʊ', 'ɔ',
  'æ', 'ɑ', 'ɑ2'
];

const CHART_LABEL_OVERRIDES = {
  'eɪ': 'e',
  'oʊ': 'o',
  'ɑ': 'a',
  'ɑ2': 'ɑ'
};

const CHART_SHEET = {
  'i':  { row: 'high', col: 'front',   u: 0.54, v: 0.20 },
  'ɪ':  { row: 'high', col: 'front',   u: 0.54, v: 0.56 },
  'ɝ':  { row: 'high', col: 'central', u: 0.30, v: 0.26 },
  'ɚ':  { row: 'high', col: 'central', u: 0.60, v: 0.26 },
  'u':  { row: 'high', col: 'back',    u: 0.54, v: 0.24 },
  'ʊ':  { row: 'high', col: 'back',    u: 0.54, v: 0.64 },

  'eɪ': { row: 'mid',  col: 'front',   u: 0.44, v: 0.28 },
  'ɛ':  { row: 'mid',  col: 'front',   u: 0.44, v: 0.74 },
  'ʌ':  { row: 'mid',  col: 'central', u: 0.34, v: 0.48 },
  'ə':  { row: 'mid',  col: 'central', u: 0.63, v: 0.48 },
  'oʊ': { row: 'mid',  col: 'back',    u: 0.38, v: 0.30 },
  'ɔ':  { row: 'mid',  col: 'back',    u: 0.38, v: 0.74 },

  'æ':  { row: 'low',  col: 'front',   u: 0.56, v: 0.40 },
  'ɑ':  { row: 'low',  col: 'front',   u: 0.60, v: 0.80 },
  'ɑ2': { row: 'low',  col: 'back',    u: 0.46, v: 0.74 }
};

function xAtY(a, b, y){
  const dy = b.y - a.y;
  if (Math.abs(dy) < 0.0001) return (a.x + b.x) / 2;
  const t = (y - a.y) / dy;
  return lerp(a.x, b.x, t);
}

function getDiagramGuides(){
  const mid = pointOnEdges(DIAGRAM.rows.mid);
  const low = pointOnEdges(DIAGRAM.rows.nearOpen);

  const frontTop = {
    x: lerp(DIAGRAM.quad.tl.x, DIAGRAM.quad.tr.x, 0.33),
    y: lerp(DIAGRAM.quad.tl.y, DIAGRAM.quad.tr.y, 0.33)
  };
  const frontBottom = {
    x: lerp(DIAGRAM.quad.bl.x, DIAGRAM.quad.br.x, 0.62),
    y: lerp(DIAGRAM.quad.bl.y, DIAGRAM.quad.br.y, 0.62)
  };

  const backTop = {
    x: lerp(DIAGRAM.quad.tl.x, DIAGRAM.quad.tr.x, 0.7),
    y: lerp(DIAGRAM.quad.tl.y, DIAGRAM.quad.tr.y, 0.7)
  };
  const backBottom = {
    x: lerp(DIAGRAM.quad.bl.x, DIAGRAM.quad.br.x, 0.7),
    y: lerp(DIAGRAM.quad.bl.y, DIAGRAM.quad.br.y, 0.7)
  };

  return { mid, low, frontTop, frontBottom, backTop, backBottom };
}

function sheetPoint(slot){
  const g = getDiagramGuides();

  const rowBands = {
    high: [DIAGRAM.quad.tl.y, g.mid.left.y],
    mid: [g.mid.left.y, g.low.left.y],
    low: [g.low.left.y, DIAGRAM.quad.bl.y]
  };

  const [y0, y1] = rowBands[slot.row] || rowBands.mid;
  const y = lerp(y0, y1, slot.v ?? 0.5);

  const left = xAtY(DIAGRAM.quad.tl, DIAGRAM.quad.bl, y);
  const right = xAtY(DIAGRAM.quad.tr, DIAGRAM.quad.br, y);
  const frontMid = xAtY(g.frontTop, g.frontBottom, y);
  const backMid = xAtY(g.backTop, g.backBottom, y);

  const colBands = {
    front: [left, frontMid],
    central: [frontMid, backMid],
    back: [backMid, right]
  };

  const [x0, x1] = colBands[slot.col] || colBands.central;
  const x = lerp(x0, x1, slot.u ?? 0.5);

  return { x, y };
}

function resolveChartNodePosition(p){
  const slot = CHART_SHEET[p.key];
  if (slot) return sheetPoint(slot);
  return resolveNodePosition(p);
}

function canonicalMonophthongForSegment(segment) {
  const prefs = SEGMENT_KEY_PREFS[segment] || [];

  for (const key of prefs) {
    const p = state.byKey.get(key);
    if (p && !isDiphthongLike(p)) return key;
  }

  for (const p of state.phonemes) {
    if (isDiphthongLike(p)) continue;
    const base = normalizeTongueLabel(p.tongue).split('→')[0].replace('+r', '').trim();
    if (base === segment) return p.key;
  }

  return null;
}

function relatedMonophthongKeys(key) {
  const p = state.byKey.get(key);
  if (!p || !isDiphthongLike(p)) return [];

  const normalized = normalizeTongueLabel(p.tongue).replace(/\+r/g, '');
  if (!normalized.includes('→')) return [];

  const segments = normalized.split('→').map((s) => s.trim()).filter(Boolean);
  const keys = segments
    .map((seg) => canonicalMonophthongForSegment(seg))
    .filter(Boolean);

  return [...new Set(keys)];
}

function el(tag, attrs={}, ...children){
  const node = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  }
  for (const ch of children.flat()){
    if (ch == null) continue;
    node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs={}, ...children){
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (k === 'class') node.setAttribute('class', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  }
  for (const ch of children.flat()){
    if (ch == null) continue;
    node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
  }
  return node;
}

function renderTileChart(){
  const root = $('#tileChart');
  root.innerHTML = '';

  const stage = el('div', { class:'tileStage', role:'application', 'aria-label':'Interactive vowel chart (quadrilateral + markers)' });
  const { w, h } = DIAGRAM.viewBox;
  const { tl, tr, br, bl } = DIAGRAM.quad;

  const svg = svgEl('svg', { class:'stageSvg', viewBox:`0 0 ${w} ${h}`, 'aria-label':'Vowel quadrilateral diagram' });

  svg.appendChild(svgEl('path', {
    class: 'guide',
    d:`M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`,
    fill:'none',
    stroke:'rgba(17,24,39,.85)',
    'stroke-width':'2.25'
  }));

  drawSlotGrid(svg);

  [
    { x: 152, y: 24, text: 'Front', cls: 'quad__label quad__label--zone' },
    { x: 252, y: 24, text: 'Central', cls: 'quad__label quad__label--zone' },
    { x: 352, y: 24, text: 'Back', cls: 'quad__label quad__label--zone' },

    { x: 62, y: 82, text: 'High', cls: 'quad__label quad__label--axis' },
    { x: 62, y: 188, text: 'Mid', cls: 'quad__label quad__label--axis' },
    { x: 68, y: 292, text: 'Low', cls: 'quad__label quad__label--axis' },

    { x: 452, y: 82, text: 'High', cls: 'quad__label quad__label--axis' },
    { x: 452, y: 188, text: 'Mid', cls: 'quad__label quad__label--axis' },
    { x: 458, y: 292, text: 'Low', cls: 'quad__label quad__label--axis' }
  ].forEach(({ x, y, text, cls }) => svg.appendChild(svgEl('text', { x, y, class: cls }, text)));

  const chartPhonemes = CHART_NODE_KEYS
    .map((key) => state.byKey.get(key))
    .filter(Boolean);

  for (const p of chartPhonemes){
    const { x, y } = resolveChartNodePosition(p);

    const node = svgEl('g', {
      class:'vowel-node',
      role:'button',
      tabindex:'0',
      transform:`translate(${x} ${y})`,
      'data-key': p.key
    });

    node.appendChild(svgEl('circle', { class:'vowel-node__dot', cx:'0', cy:'0', r:'11' }));

    if (state.showLabels) {
      const label = CHART_LABEL_OVERRIDES[p.key] || p.display || p.ipa;
      node.appendChild(svgEl('text', { class:'vowel-node__ipa', x:'0', y:'1.5' }, label));
    }

    wireInteractive(node, p);
    svg.appendChild(node);
  }

  stage.appendChild(svg);
  root.appendChild(stage);
}

function renderTable(){
  const tbody = $('#refTable tbody');
  tbody.innerHTML = '';

  for (const p of state.phonemes){
    const tr = el('tr', { 'data-key': p.key },
      el('td', {}, el('code', {}, `/${p.ipa}/`)),
      el('td', {}, (p.example||[]).join(', ')),
      el('td', {}, p.tongue || ''),
      el('td', {}, p.lips || ''),
      el('td', {}, p.length || '')
    );
    tr.addEventListener('mouseenter', () => setHover(p.key));
    tr.addEventListener('mouseleave', () => setHover(null));
    tr.addEventListener('click', () => setSelected(p.key));
    tbody.appendChild(tr);
  }
}

function renderQuad(){
  // Quadrilateral is merged into the main chart now.
}

function slugWord(w){
  return (w||'')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'');
}

function audioUrlForPhoneme(p){
  return `./audio/phonemes/${encodeURIComponent(p.key)}.mp3`;
}

function audioUrlForWord(w){
  return `./audio/words/${encodeURIComponent(slugWord(w))}.mp3`;
}

const audioCache = new Map();
let activeAudio = null;

function getAudioClip(url){
  let clip = audioCache.get(url);
  if (!clip){
    clip = new Audio(url);
    clip.preload = 'auto';
    clip.load();
    audioCache.set(url, clip);
  }
  return clip;
}

function primeAudio(url){
  try { getAudioClip(url); } catch {}
}

function waitForReady(audioEl, timeoutMs = 1200){
  if (audioEl.readyState >= 2) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audioEl.removeEventListener('loadeddata', finish);
      audioEl.removeEventListener('canplay', finish);
      audioEl.removeEventListener('canplaythrough', finish);
      resolve();
    };

    audioEl.addEventListener('loadeddata', finish, { once: true });
    audioEl.addEventListener('canplay', finish, { once: true });
    audioEl.addEventListener('canplaythrough', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

async function playUrl(url){
  const clip = getAudioClip(url);

  if (activeAudio && activeAudio !== clip){
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }

  await waitForReady(clip);
  clip.pause();
  clip.currentTime = 0;
  activeAudio = clip;
  await clip.play();
}

function playPhoneme(p){
  const url = audioUrlForPhoneme(p);
  return playUrl(url);
}

function playButton(label, url, enabled){
  const btn = el('button', { class:`play ${enabled ? '' : 'is-disabled'}`, type:'button', 'aria-label': label });
  btn.textContent = enabled ? `▶ ${label}` : `⏸ ${label}`;
  if (!enabled) btn.disabled = true;

  btn.addEventListener('pointerenter', () => primeAudio(url), { once: true });
  btn.addEventListener('focus', () => primeAudio(url), { once: true });
  btn.addEventListener('click', async () => {
    try{ await playUrl(url); }
    catch(err){ console.warn('Audio play failed', err); }
  });
  return btn;
}

function renderDetails(){
  const root = $('#details');
  const p = state.selected ? state.byKey.get(state.selected) : null;

  if (!p){
    root.innerHTML = '<div class="card__empty">Select a vowel to see details.</div>';
    return;
  }

  const examples = (p.example||[]);
  const phonemeAudio = audioUrlForPhoneme(p);

  primeAudio(phonemeAudio);
  examples.slice(0, 6).forEach((w) => primeAudio(audioUrlForWord(w)));

  root.innerHTML = '';
  root.appendChild(el('div', { class:'card__sym' }, `/${p.ipa}/`));

  const typeDisplay = isDiphthongLike(p)
    ? (p.tongue || p.type)
    : (p.type || '—');

  root.appendChild(el('div', { class:'card__row' },
    el('span', { class:'badge' }, 'IPA ', el('code', {}, p.ipa)),
    el('span', { class:'badge' }, 'Type ', el('code', {}, typeDisplay)),
    el('span', { class:'badge' }, 'Rhotic ', el('code', {}, String(!!p.rhotic)))
  ));

  root.appendChild(el('div', { class:'card__row' },
    el('span', { class:'badge' }, 'Tongue ', el('code', {}, p.tongue || '—')),
    el('span', { class:'badge' }, 'Lips ', el('code', {}, p.lips || '—')),
    el('span', { class:'badge' }, 'Length ', el('code', {}, p.length || '—'))
  ));

  root.appendChild(el('div', { class:'card__section' },
    el('h3', {}, 'Audio'),
    el('div', { class:'playRow' },
      playButton(`/${p.ipa}/`, phonemeAudio, true)
    )
  ));

  root.appendChild(el('div', { class:'card__section' },
    el('h3', {}, 'Examples'),
    examples.length
      ? el('ul', { class:'card__list' },
          ...examples.map(w => {
            const url = audioUrlForWord(w);
            return el('li', {},
              el('span', { class:'exWord' }, w),
              ' ',
              playButton(w, url, true)
            );
          })
        )
      : el('div', { class:'card__empty' }, 'No examples yet.')
  ));
}

function wireInteractive(node, p){
  node.addEventListener('mouseenter', () => { setHover(p.key); showTooltip(node, p); });
  node.addEventListener('mouseleave', () => { setHover(null); hideTooltip(); });
  node.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
  node.addEventListener('focus', () => { setHover(p.key); showTooltip(node, p); });
  node.addEventListener('blur', () => { setHover(null); hideTooltip(); });
  node.addEventListener('click', () => {
    setSelected(p.key);
    // If the user clicked, make it playable immediately.
    playPhoneme(p).catch(()=>{});
  });
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(p.key);
      playPhoneme(p).catch(()=>{});
    }
  });
}

function setSelected(key){
  state.selected = key;
  syncHighlights();
  renderDetails();

  const p = state.byKey.get(key);
  if (p) {
    primeAudio(audioUrlForPhoneme(p));
    (p.example || []).slice(0, 4).forEach((w) => primeAudio(audioUrlForWord(w)));
  }
}

function setHover(key){
  state.hover = key;
  syncHighlights();
}

function syncHighlights(){
  const selectedLinked = new Set(state.selected ? relatedMonophthongKeys(state.selected) : []);
  const hoverLinked = new Set(state.hover ? relatedMonophthongKeys(state.hover) : []);

  // Diagram nodes
  document.querySelectorAll('.stageSvg [data-key]').forEach(node => {
    const k = node.getAttribute('data-key');

    const isDirectHover = !!state.hover && state.hover === k;
    const isLinkedHover = !isDirectHover && hoverLinked.has(k);

    const isDirectSelected = !!state.selected && state.selected === k;
    const isLinkedSelected = !isDirectSelected && selectedLinked.has(k);

    node.classList.toggle('is-hover', isDirectHover || isLinkedHover);
    node.classList.toggle('is-selected', isDirectSelected || isLinkedSelected);
  });

  // Table rows
  document.querySelectorAll('#refTable tbody tr').forEach(tr => {
    const k = tr.getAttribute('data-key');
    tr.classList.toggle('is-selected', !!state.selected && state.selected === k);
  });
}

// Tooltip
const tip = $('#tooltip');
function showTooltip(node, p){
  const ex = (p.example||[]).slice(0,3).join(', ');
  tip.innerHTML = `
    <div class="tooltip__sym">/${p.ipa}/</div>
    <div class="tooltip__ex">${ex || ''}</div>
  `;
  tip.setAttribute('data-show','1');
  tip.setAttribute('aria-hidden','false');
}
function moveTooltip(x,y){
  const pad = 14;
  const w = tip.offsetWidth || 260;
  const h = tip.offsetHeight || 60;
  const nx = Math.min(window.innerWidth - w - pad, x + 12);
  const ny = Math.min(window.innerHeight - h - pad, y + 12);
  tip.style.left = `${Math.max(pad, nx)}px`;
  tip.style.top = `${Math.max(pad, ny)}px`;
}
function hideTooltip(){
  tip.removeAttribute('data-show');
  tip.setAttribute('aria-hidden','true');
}

function applySearch(q){
  const query = normalizeQuery(q);
  if (!query) return;

  // Try by key/ipa first
  for (const p of state.phonemes){
    if (normalizeQuery(p.key) === query || normalizeQuery(p.ipa) === query || normalizeQuery(p.display) === query){
      setSelected(p.key);
      return;
    }
  }

  // Try examples
  for (const p of state.phonemes){
    if ((p.example||[]).some(w => w.toLowerCase().includes(query))){
      setSelected(p.key);
      return;
    }
  }
}

async function load(){
  const res = await fetch('./data/phonemes.json');
  const json = await res.json();

  state.phonemes = json.phonemes || [];
  state.byKey = new Map(state.phonemes.map(p => [p.key, p]));

  // Initial selection (nice demo)
  state.selected = state.phonemes[0]?.key || null;

  renderAll();

  // Re-render chart on resize for scaling
  window.addEventListener('resize', () => {
    renderTileChart();
    syncHighlights();
  });

  // Controls
  $('#toggleLabels').addEventListener('change', (e) => {
    state.showLabels = !!e.target.checked;
    renderAll();
  });

  $('#search').addEventListener('input', (e) => applySearch(e.target.value));
}

function renderAll(){
  renderTileChart();
  renderTable();
  renderQuad();
  renderDetails();
  syncHighlights();
}

load();
