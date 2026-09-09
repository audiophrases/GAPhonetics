const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  phonemes: [],
  byKey: new Map(),
  selected: null,
  hover: null,
  showLabels: true,
  showGlides: true,
  anatomyMode: 'subtle', // 'subtle' | 'full' | 'off'
  activeFilter: 'all',
  compareMode: false,
  compareA: 'i',
  compareB: 'ɪ',
  playbackRate: 1.0,
  loopCount: 1,
  activeAudio: null,
  searchQuery: ''
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pointOnEdges(t) {
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

function xAtY(a, b, y) {
  const dy = b.y - a.y;
  if (Math.abs(dy) < 0.0001) return (a.x + b.x) / 2;
  const t = (y - a.y) / dy;
  return lerp(a.x, b.x, t);
}

function getDiagramGuides() {
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

function sheetPoint(slot) {
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

function resolveChartNodePosition(p) {
  const slot = CHART_SHEET[p.key];
  if (slot) return sheetPoint(slot);
  if (p.quad?.x != null && p.quad?.y != null) return p.quad;
  return { x: 260, y: 180 };
}

function normalizeQuery(q) {
  return (q || '')
    .trim()
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/\/$/, '');
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
  if (!p) return [];

  // If explicit glide path exists, use that
  if (p.glide?.path) {
    return p.glide.path;
  }

  if (!isDiphthongLike(p)) return [];

  const normalized = normalizeTongueLabel(p.tongue).replace(/\+r/g, '');
  if (!normalized.includes('→')) return [];

  const segments = normalized.split('→').map((s) => s.trim()).filter(Boolean);
  const keys = segments
    .map((seg) => canonicalMonophthongForSegment(seg))
    .filter(Boolean);

  return [...new Set(keys)];
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  }
  for (const ch of children.flat()) {
    if (ch == null) continue;
    node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.setAttribute('class', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  }
  for (const ch of children.flat()) {
    if (ch == null) continue;
    node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
  }
  return node;
}

/* ==========================================================================
   VOCAL TRACT SAGITTAL ANATOMY DRAWING
   Maps to quadrilateral: Left=Front(Teeth), Right=Back(Throat), Top=Roof, Bottom=Floor
   ========================================================================== */
function drawVocalTractAnatomy(svg) {
  if (state.anatomyMode === 'off') return;

  const g = svgEl('g', {
    class: `vocal-tract-layer vocal-tract-layer--${state.anatomyMode}`,
    'aria-hidden': 'true'
  });

  // Soft background tint representing head tissue
  g.appendChild(svgEl('path', {
    class: 'vt-tissue',
    d: `
      M 28 32
      C 22 55 12 75 8 92
      C 18 96 24 104 14 116
      C 22 125 24 132 16 144
      C 26 166 22 195 24 212
      C 32 254 75 285 140 315
      C 210 338 290 350 365 352
      C 410 352 450 330 470 290
      C 490 240 488 120 480 50
      C 460 20 400 12 320 12
      Z
    `
  }));

  // Sagittal Head Outline (Front profile facing Left)
  g.appendChild(svgEl('path', {
    class: 'vt-profile',
    d: `
      M 32 20
      C 25 45 15 72 8 88
      C 16 94 22 102 14 114
      C 22 122 25 128 16 140
      C 26 165 24 188 22 208
      C 28 245 60 280 115 310
      C 165 332 245 350 320 355
    `
  }));

  // Upper & Lower Lips vermilion
  g.appendChild(svgEl('path', {
    class: 'vt-lips',
    d: `
      M 24 106 C 14 114 14 118 26 122
      M 24 136 C 16 140 18 146 26 146
    `
  }));

  // Teeth (Upper incisors at ~ (65, 115) and Lower incisors at ~ (68, 145))
  g.appendChild(svgEl('polygon', {
    class: 'vt-teeth',
    points: '64,104 74,105 72,122 65,122'
  }));
  g.appendChild(svgEl('polygon', {
    class: 'vt-teeth',
    points: '67,138 73,138 72,152 66,152'
  }));

  // Roof of the Mouth: Alveolar Ridge -> Hard Palate -> Velum -> Uvula
  g.appendChild(svgEl('path', {
    class: 'vt-palate',
    d: `
      M 65 104
      C 66 85 78 55 92 40
      C 115 28 200 24 280 28
      C 335 32 380 44 410 70
      C 418 78 418 90 412 92
      C 406 94 402 84 395 72
      C 370 56 325 46 270 42
    `
  }));

  // Pharyngeal Wall (Back wall of throat)
  g.appendChild(svgEl('path', {
    class: 'vt-pharynx',
    d: `
      M 432 28
      C 445 42 452 75 450 120
      C 448 180 435 245 410 295
      C 390 325 372 342 360 355
    `
  }));

  // Lower Jaw / Floor of mouth / Sublingual
  g.appendChild(svgEl('path', {
    class: 'vt-mandible',
    d: `
      M 68 152
      C 75 190 98 245 145 285
      C 195 315 255 330 320 338
      C 340 338 350 348 355 355
    `
  }));

  // Tongue Body Silhouette (translucent mass filling oral cavity)
  g.appendChild(svgEl('path', {
    class: 'vt-tongue',
    d: `
      M 75 145
      C 95 140 120 125 150 120
      C 200 115 250 125 290 145
      C 340 170 375 220 370 280
      C 365 310 340 325 315 328
      C 240 318 160 290 110 240
      C 85 200 75 165 75 145
      Z
    `
  }));

  // Vocal folds / Glottis & Epiglottis marker (throat origin of sound)
  g.appendChild(svgEl('path', {
    class: 'vt-larynx',
    d: `
      M 360 318 C 366 325 368 335 360 345
      M 352 332 L 368 332
    `
  }));

  // Direction Compass / Facing Indicator
  const compass = svgEl('g', { class: 'vt-compass', transform: 'translate(32, 340)' });
  compass.appendChild(svgEl('text', { class: 'vt-compass__text', x: '0', y: '0' }, '🗣 Speaker faces LEFT (Teeth/Lips)'));
  g.appendChild(compass);

  // Anatomical Callout Pills & Text
  const callouts = [
    { x: 42, y: 76, label: 'LIPS & TEETH', sub: '(Front)', anchor: 'middle' },
    { x: 175, y: 18, label: 'HARD PALATE', sub: '(Roof / High)', anchor: 'middle' },
    { x: 440, y: 16, label: 'VELUM & THROAT', sub: '(Soft Palate / Back)', anchor: 'end' },
    { x: 260, y: 342, label: 'OPEN JAW & FLOOR', sub: '(Low / Depressed)', anchor: 'middle' }
  ];

  callouts.forEach(({ x, y, label, sub, anchor }) => {
    const textGroup = svgEl('g', { class: 'vt-callout' });
    textGroup.appendChild(svgEl('text', {
      class: 'vt-callout__title',
      x,
      y,
      'text-anchor': anchor
    }, label));
    textGroup.appendChild(svgEl('text', {
      class: 'vt-callout__sub',
      x,
      y: y + 10,
      'text-anchor': anchor
    }, sub));
    g.appendChild(textGroup);
  });

  svg.appendChild(g);
}

function drawSlotGrid(svg) {
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

/* ==========================================================================
   DIPHTHONG & RHOTIC GLIDE TRAJECTORY ARROW DRAWING
   ========================================================================== */
function drawGlideTrajectories(svg) {
  if (!state.showGlides) return;

  const activeKey = state.hover || state.selected;
  if (!activeKey) return;

  const p = state.byKey.get(activeKey);
  if (!p) return;

  const glide = p.glide;
  if (!glide) return;

  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'glide-arrow',
    viewBox: '0 0 10 10',
    refX: '7',
    refY: '5',
    markerWidth: '6',
    markerHeight: '6',
    orient: 'auto-start-reverse'
  });
  marker.appendChild(svgEl('path', {
    d: 'M 0 1.5 L 8 5 L 0 8.5 z',
    fill: '#e11d48'
  }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const group = svgEl('g', { class: 'glide-overlay' });

  const pathKeys = glide.path || [glide.from, glide.to];
  const points = pathKeys
    .map((k) => {
      const node = state.byKey.get(k);
      return node ? resolveChartNodePosition(node) : null;
    })
    .filter(Boolean);

  if (points.length < 2) return;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Curve slightly outward to avoid hitting labels
    const midX = (p1.x + p2.x) / 2 + (p1.y - p2.y) * 0.12;
    const midY = (p1.y + p2.y) / 2 + (p2.x - p1.x) * 0.12;

    const path = svgEl('path', {
      class: 'glide-path',
      d: `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`,
      fill: 'none',
      stroke: '#e11d48',
      'stroke-width': '2.75',
      'marker-end': 'url(#glide-arrow)'
    });

    group.appendChild(path);

    // Pulse dot at start
    group.appendChild(svgEl('circle', {
      class: 'glide-pulse-dot',
      cx: p1.x,
      cy: p1.y,
      r: '6',
      fill: '#e11d48'
    }));

    // Midpoint trajectory label
    const labelBg = svgEl('rect', {
      class: 'glide-badge-bg',
      x: midX - 22,
      y: midY - 10,
      width: '44',
      height: '18',
      rx: '9'
    });
    const labelText = svgEl('text', {
      class: 'glide-badge-text',
      x: midX,
      y: midY + 3.5,
      'text-anchor': 'middle'
    }, `/${p.ipa}/`);

    group.appendChild(labelBg);
    group.appendChild(labelText);
  }

  svg.appendChild(group);
}

/* ==========================================================================
   VOWEL COMPARISON DISTANCE VECTOR DRAWING
   ========================================================================== */
function drawCompareVector(svg) {
  if (!state.compareMode) return;

  const nodeA = state.byKey.get(state.compareA);
  const nodeB = state.byKey.get(state.compareB);
  if (!nodeA || !nodeB || nodeA === nodeB) return;

  const pA = resolveChartNodePosition(nodeA);
  const pB = resolveChartNodePosition(nodeB);

  const group = svgEl('g', { class: 'compare-vector-layer' });

  group.appendChild(svgEl('line', {
    class: 'compare-line',
    x1: pA.x,
    y1: pA.y,
    x2: pB.x,
    y2: pB.y
  }));

  svg.appendChild(group);
}

function matchesActiveFilter(p) {
  if (state.activeFilter === 'all') return true;
  if (state.activeFilter === 'monophthong') {
    return p.type === 'monophthong' || p.type === 'anchor';
  }
  if (state.activeFilter === 'diphthong') {
    return p.type === 'diphthong' || isDiphthongLike(p);
  }
  if (state.activeFilter === 'rhotic') {
    return p.rhotic === true || p.type === 'r-colored' || (p.tongue || '').includes('+r');
  }
  if (state.activeFilter === 'front') {
    return (p.tongue || '').toLowerCase().includes('front');
  }
  if (state.activeFilter === 'central') {
    return (p.tongue || '').toLowerCase().includes('central');
  }
  if (state.activeFilter === 'back') {
    return (p.tongue || '').toLowerCase().includes('back');
  }
  return true;
}

function renderTileChart() {
  const root = $('#tileChart');
  root.innerHTML = '';

  const stage = el('div', {
    class: 'tileStage',
    role: 'application',
    'aria-label': 'Interactive vowel chart with vocal tract cross-section'
  });
  const { w, h } = DIAGRAM.viewBox;
  const { tl, tr, br, bl } = DIAGRAM.quad;

  const svg = svgEl('svg', {
    class: 'stageSvg',
    viewBox: `0 0 ${w} ${h}`,
    'aria-label': 'Vowel quadrilateral with anatomical vocal tract cross-section'
  });

  // Layer 1: Anatomical Vocal Tract Cross Section (sagittal view)
  drawVocalTractAnatomy(svg);

  // Layer 2: Quadrilateral Boundary
  svg.appendChild(svgEl('path', {
    class: 'guide',
    d: `M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`,
    fill: 'none',
    stroke: 'rgba(17,24,39,.85)',
    'stroke-width': '2.25'
  }));

  // Layer 3: Grid Partitions
  drawSlotGrid(svg);

  // Axis Labels
  [
    { x: 152, y: 32, text: 'Front', cls: 'quad__label quad__label--zone' },
    { x: 252, y: 32, text: 'Central', cls: 'quad__label quad__label--zone' },
    { x: 352, y: 32, text: 'Back', cls: 'quad__label quad__label--zone' },

    { x: 62, y: 82, text: 'High', cls: 'quad__label quad__label--axis' },
    { x: 62, y: 188, text: 'Mid', cls: 'quad__label quad__label--axis' },
    { x: 68, y: 292, text: 'Low', cls: 'quad__label quad__label--axis' },

    { x: 452, y: 82, text: 'High', cls: 'quad__label quad__label--axis' },
    { x: 452, y: 188, text: 'Mid', cls: 'quad__label quad__label--axis' },
    { x: 458, y: 292, text: 'Low', cls: 'quad__label quad__label--axis' }
  ].forEach(({ x, y, text, cls }) => svg.appendChild(svgEl('text', { x, y, class: cls }, text)));

  // Layer 4: Glide Trajectories & Compare Vectors
  drawGlideTrajectories(svg);
  drawCompareVector(svg);

  // Layer 5: Phoneme Nodes
  const chartPhonemes = CHART_NODE_KEYS
    .map((key) => state.byKey.get(key))
    .filter(Boolean);

  for (const p of chartPhonemes) {
    const { x, y } = resolveChartNodePosition(p);
    const matchesFilter = matchesActiveFilter(p);

    const isCompA = state.compareMode && state.compareA === p.key;
    const isCompB = state.compareMode && state.compareB === p.key;

    const nodeClasses = ['vowel-node'];
    if (!matchesFilter) nodeClasses.push('is-dimmed');
    if (isCompA) nodeClasses.push('is-compare-a');
    if (isCompB) nodeClasses.push('is-compare-b');

    const node = svgEl('g', {
      class: nodeClasses.join(' '),
      role: 'button',
      tabindex: '0',
      transform: `translate(${x} ${y})`,
      'data-key': p.key,
      'aria-label': `Vowel /${p.ipa}/ (${p.tongue || ''})`
    });

    node.appendChild(svgEl('circle', { class: 'vowel-node__dot', cx: '0', cy: '0', r: '12' }));

    if (state.showLabels) {
      const label = CHART_LABEL_OVERRIDES[p.key] || p.display || p.ipa;
      node.appendChild(svgEl('text', { class: 'vowel-node__ipa', x: '0', y: '1.5' }, label));
    }

    // Comparison tags A / B
    if (isCompA) {
      node.appendChild(svgEl('circle', { class: 'comp-badge comp-badge--a', cx: '-12', cy: '-10', r: '6.5' }));
      node.appendChild(svgEl('text', { class: 'comp-badge-text', x: '-12', y: '-7.5' }, 'A'));
    } else if (isCompB) {
      node.appendChild(svgEl('circle', { class: 'comp-badge comp-badge--b', cx: '12', cy: '-10', r: '6.5' }));
      node.appendChild(svgEl('text', { class: 'comp-badge-text', x: '12', y: '-7.5' }, 'B'));
    }

    wireInteractive(node, p);
    svg.appendChild(node);
  }

  stage.appendChild(svg);
  root.appendChild(stage);
}

function renderTable() {
  const tbody = $('#refTable tbody');
  tbody.innerHTML = '';

  let visibleCount = 0;

  for (const p of state.phonemes) {
    const matches = matchesActiveFilter(p);
    if (matches) visibleCount++;

    const isCompA = state.compareMode && state.compareA === p.key;
    const isCompB = state.compareMode && state.compareB === p.key;

    const trClasses = [];
    if (!matches) trClasses.push('is-dimmed');
    if (isCompA) trClasses.push('is-compare-a');
    if (isCompB) trClasses.push('is-compare-b');

    const tr = el('tr', { 'data-key': p.key, class: trClasses.join(' ') },
      el('td', {},
        el('code', { class: 'sym-code' }, `/${p.ipa}/`),
        isCompA ? el('span', { class: 'badge badge--a' }, 'A') : null,
        isCompB ? el('span', { class: 'badge badge--b' }, 'B') : null
      ),
      el('td', {}, (p.example || []).join(', ')),
      el('td', {}, p.tongue || ''),
      el('td', {}, p.lips || ''),
      el('td', {}, p.length || p.type || '')
    );

    tr.addEventListener('mouseenter', () => setHover(p.key));
    tr.addEventListener('mouseleave', () => setHover(null));
    tr.addEventListener('click', () => {
      if (state.compareMode) {
        // If clicking while compare mode is active, set B if A is already chosen
        if (state.selected === p.key) {
          state.compareB = p.key;
        } else {
          state.compareA = p.key;
        }
        syncCompareDropdowns();
      }
      setSelected(p.key);
      playPhoneme(p).catch(() => {});
    });

    tbody.appendChild(tr);
  }

  const countEl = $('#tableCount');
  if (countEl) {
    countEl.textContent = `${visibleCount} of ${state.phonemes.length} vowels`;
  }
}

function slugWord(w) {
  return (w || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function audioUrlForPhoneme(p) {
  return `./audio/phonemes/${encodeURIComponent(p.key)}.mp3`;
}

function audioUrlForWord(w) {
  return `./audio/words/${encodeURIComponent(slugWord(w))}.mp3`;
}

const audioCache = new Map();

function getAudioClip(url) {
  let clip = audioCache.get(url);
  if (!clip) {
    clip = new Audio(url);
    clip.preload = 'auto';
    clip.load();
    audioCache.set(url, clip);
  }
  return clip;
}

function primeAudio(url) {
  try { getAudioClip(url); } catch {}
}

function waitForReady(audioEl, timeoutMs = 1200) {
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

async function playUrl(url, targetBtn = null) {
  const clip = getAudioClip(url);

  if (state.activeAudio && state.activeAudio !== clip) {
    state.activeAudio.pause();
    state.activeAudio.currentTime = 0;
  }

  clip.playbackRate = state.playbackRate;

  if (targetBtn) {
    targetBtn.classList.add('is-playing');
  }

  await waitForReady(clip);
  clip.pause();
  clip.currentTime = 0;
  state.activeAudio = clip;

  let repeatsLeft = state.loopCount - 1;

  const handleEnded = async () => {
    if (repeatsLeft > 0) {
      repeatsLeft--;
      await new Promise((r) => setTimeout(r, 320));
      clip.currentTime = 0;
      await clip.play();
    } else {
      if (targetBtn) targetBtn.classList.remove('is-playing');
      clip.removeEventListener('ended', handleEnded);
    }
  };

  clip.addEventListener('ended', handleEnded);

  try {
    await clip.play();
  } catch (err) {
    console.warn('Audio play failed', err);
    if (targetBtn) targetBtn.classList.remove('is-playing');
  }
}

function playPhoneme(p, targetBtn = null) {
  const url = audioUrlForPhoneme(p);
  return playUrl(url, targetBtn);
}

function playButton(label, url, enabled = true) {
  const btn = el('button', {
    class: `play ${enabled ? '' : 'is-disabled'}`,
    type: 'button',
    'aria-label': `Play ${label}`
  });
  btn.innerHTML = `<span class="play__icon">▶</span> <span class="play__label">${label}</span>`;
  if (!enabled) btn.disabled = true;

  btn.addEventListener('pointerenter', () => primeAudio(url), { once: true });
  btn.addEventListener('focus', () => primeAudio(url), { once: true });
  btn.addEventListener('click', async () => {
    try { await playUrl(url, btn); } catch (err) {}
  });
  return btn;
}

/* ==========================================================================
   DETAILS RENDERING: SINGLE PHONEME vs COMPARISON MODE
   ========================================================================== */
function renderDetails() {
  const root = $('#details');

  if (state.compareMode) {
    renderCompareCard(root);
    return;
  }

  const p = state.selected ? state.byKey.get(state.selected) : null;

  if (!p) {
    root.innerHTML = '<div class="card__empty">Select a vowel to inspect articulatory placement and audio recordings.</div>';
    return;
  }

  const examples = p.example || [];
  const phonemeAudio = audioUrlForPhoneme(p);

  primeAudio(phonemeAudio);
  examples.slice(0, 6).forEach((w) => primeAudio(audioUrlForWord(w)));

  root.innerHTML = '';

  // Top header with big symbol + display name
  const header = el('div', { class: 'card__header' },
    el('div', { class: 'card__sym' }, `/${p.ipa}/`),
    el('div', { class: 'card__meta' },
      el('div', { class: 'card__type' }, p.tongue || p.type || 'Monophthong'),
      el('div', { class: 'card__badges' },
        el('span', { class: 'badge' }, 'IPA: ', el('code', {}, p.ipa)),
        el('span', { class: 'badge' }, 'Lips: ', el('strong', {}, p.lips || 'unrounded')),
        el('span', { class: 'badge' }, 'Length: ', el('strong', {}, p.length || 'normal')),
        p.rhotic ? el('span', { class: 'badge badge--rhotic' }, 'Rhotic (/r/)') : null
      )
    )
  );
  root.appendChild(header);

  // Audio Playback with Speed and Loop controls
  const audioSection = el('div', { class: 'card__section card__section--audio' },
    el('div', { class: 'audioControlsHeader' },
      el('h3', {}, 'Audio Recordings'),
      el('div', { class: 'audioOptions' },
        el('button', {
          class: `btnSpeed ${state.playbackRate === 0.75 ? 'is-active' : ''}`,
          type: 'button',
          onclick: () => {
            state.playbackRate = state.playbackRate === 0.75 ? 1.0 : 0.75;
            renderDetails();
          }
        }, state.playbackRate === 0.75 ? '0.75x Slow' : '1.0x Normal'),
        el('button', {
          class: `btnLoop ${state.loopCount === 3 ? 'is-active' : ''}`,
          type: 'button',
          onclick: () => {
            state.loopCount = state.loopCount === 3 ? 1 : 3;
            renderDetails();
          }
        }, state.loopCount === 3 ? '🔁 Repeat: 3x' : '🔁 Loop: Off')
      )
    ),
    el('div', { class: 'playRow' },
      playButton(`Phoneme /${p.ipa}/`, phonemeAudio, true)
    )
  );
  root.appendChild(audioSection);

  // ARTICULATORY ANATOMY & PLACEMENT SENSATION GUIDE
  const art = p.articulatory || {};
  const anatomySection = el('div', { class: 'card__section card__section--anatomy' },
    el('h3', {}, 'Mouth & Throat Articulatory Placement'),
    el('div', { class: 'artGrid' },
      el('div', { class: 'artItem' },
        el('div', { class: 'artItem__title' }, '👅 Tongue Position'),
        el('div', { class: 'artItem__desc' }, art.tongue || p.tongue || 'Standard placement in oral cavity.')
      ),
      el('div', { class: 'artItem' },
        el('div', { class: 'artItem__title' }, '📐 Jaw & Throat Sensation'),
        el('div', { class: 'artItem__desc' }, art.jaw || 'Neutral jaw opening.')
      ),
      el('div', { class: 'artItem' },
        el('div', { class: 'artItem__title' }, '👄 Lip Posture'),
        el('div', { class: 'artItem__desc' }, art.lips || p.lips || 'Unrounded / neutral.')
      ),
      art.cue ? el('div', { class: 'artItem artItem--cue' },
        el('div', { class: 'artItem__title' }, '💡 Physical Practice Cue (What to feel)'),
        el('div', { class: 'artItem__desc' }, art.cue)
      ) : null
    )
  );
  root.appendChild(anatomySection);

  // Example words
  if (examples.length) {
    const exSection = el('div', { class: 'card__section' },
      el('h3', {}, 'Example Words'),
      el('div', { class: 'wordChips' },
        ...examples.map((w) => {
          const url = audioUrlForWord(w);
          return playButton(w, url, true);
        })
      )
    );
    root.appendChild(exSection);
  }
}

function renderCompareCard(root) {
  const pA = state.byKey.get(state.compareA);
  const pB = state.byKey.get(state.compareB);

  if (!pA || !pB) {
    root.innerHTML = '<div class="card__empty">Select two vowels to contrast.</div>';
    return;
  }

  root.innerHTML = '';

  const compHeader = el('div', { class: 'compareCard__head' },
    el('div', { class: 'compareCard__title' },
      'Contrasting: ',
      el('span', { class: 'tag tag--a' }, `/${pA.ipa}/`),
      ' vs ',
      el('span', { class: 'tag tag--b' }, `/${pB.ipa}/`)
    ),
    el('button', {
      class: 'btn btn--accent',
      type: 'button',
      onclick: () => playCompareSequence(pA, pB)
    }, '▶ Play Sequence (A then B)')
  );
  root.appendChild(compHeader);

  // Two Column Comparison
  const columns = el('div', { class: 'compareColumns' },
    // Col A
    el('div', { class: 'compCol compCol--a' },
      el('div', { class: 'compCol__head' },
        el('span', { class: 'badge badge--a' }, 'Vowel A'),
        el('span', { class: 'compSym' }, `/${pA.ipa}/`)
      ),
      el('div', { class: 'compProp' }, el('strong', {}, 'Tongue: '), pA.tongue || '—'),
      el('div', { class: 'compProp' }, el('strong', {}, 'Lips: '), pA.lips || '—'),
      el('div', { class: 'compProp' }, el('strong', {}, 'Type: '), pA.type || pA.length || '—'),
      el('div', { class: 'compCue' }, (pA.articulatory?.cue) || (pA.articulatory?.tongue) || ''),
      el('div', { class: 'compAudio' },
        playButton(`/${pA.ipa}/`, audioUrlForPhoneme(pA), true)
      ),
      el('div', { class: 'compWords' },
        (pA.example || []).slice(0, 3).map((w) => playButton(w, audioUrlForWord(w), true))
      )
    ),

    // Col B
    el('div', { class: 'compCol compCol--b' },
      el('div', { class: 'compCol__head' },
        el('span', { class: 'badge badge--b' }, 'Vowel B'),
        el('span', { class: 'compSym' }, `/${pB.ipa}/`)
      ),
      el('div', { class: 'compProp' }, el('strong', {}, 'Tongue: '), pB.tongue || '—'),
      el('div', { class: 'compProp' }, el('strong', {}, 'Lips: '), pB.lips || '—'),
      el('div', { class: 'compProp' }, el('strong', {}, 'Type: '), pB.type || pB.length || '—'),
      el('div', { class: 'compCue' }, (pB.articulatory?.cue) || (pB.articulatory?.tongue) || ''),
      el('div', { class: 'compAudio' },
        playButton(`/${pB.ipa}/`, audioUrlForPhoneme(pB), true)
      ),
      el('div', { class: 'compWords' },
        (pB.example || []).slice(0, 3).map((w) => playButton(w, audioUrlForWord(w), true))
      )
    )
  );
  root.appendChild(columns);
}

async function playCompareSequence(pA, pB) {
  try {
    await playPhoneme(pA);
    await new Promise((r) => setTimeout(r, 450));
    await playPhoneme(pB);
  } catch (err) {
    console.warn('Compare sequence failed', err);
  }
}

function wireInteractive(node, p) {
  node.addEventListener('mouseenter', () => {
    setHover(p.key);
    showTooltip(node, p);
  });
  node.addEventListener('mouseleave', () => {
    setHover(null);
    hideTooltip();
  });
  node.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
  node.addEventListener('focus', () => {
    setHover(p.key);
    showTooltip(node, p);
  });
  node.addEventListener('blur', () => {
    setHover(null);
    hideTooltip();
  });
  node.addEventListener('click', () => {
    if (state.compareMode) {
      if (state.compareA !== p.key) {
        state.compareB = p.key;
      }
      syncCompareDropdowns();
    }
    setSelected(p.key);
    playPhoneme(p).catch(() => {});
  });
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(p.key);
      playPhoneme(p).catch(() => {});
    }
  });
}

function setSelected(key) {
  state.selected = key;
  syncHighlights();
  renderDetails();

  const p = state.byKey.get(key);
  if (p) {
    primeAudio(audioUrlForPhoneme(p));
    (p.example || []).slice(0, 4).forEach((w) => primeAudio(audioUrlForWord(w)));
  }
}

function setHover(key) {
  state.hover = key;
  syncHighlights();
}

function syncHighlights() {
  const selectedLinked = new Set(state.selected ? relatedMonophthongKeys(state.selected) : []);
  const hoverLinked = new Set(state.hover ? relatedMonophthongKeys(state.hover) : []);

  // Diagram nodes
  document.querySelectorAll('.stageSvg [data-key]').forEach((node) => {
    const k = node.getAttribute('data-key');

    const isDirectHover = !!state.hover && state.hover === k;
    const isLinkedHover = !isDirectHover && hoverLinked.has(k);

    const isDirectSelected = !!state.selected && state.selected === k;
    const isLinkedSelected = !isDirectSelected && selectedLinked.has(k);

    node.classList.toggle('is-hover', isDirectHover || isLinkedHover);
    node.classList.toggle('is-selected', isDirectSelected || isLinkedSelected);
  });

  // Table rows
  document.querySelectorAll('#refTable tbody tr').forEach((tr) => {
    const k = tr.getAttribute('data-key');
    tr.classList.toggle('is-selected', !!state.selected && state.selected === k);
  });
}

// Tooltip
const tip = $('#tooltip');
function showTooltip(node, p) {
  const ex = (p.example || []).slice(0, 3).join(', ');
  const artCue = p.articulatory?.cue ? `<div class="tooltip__cue">💡 ${p.articulatory.cue}</div>` : '';

  tip.innerHTML = `
    <div class="tooltip__sym">/${p.ipa}/ <span class="tooltip__pos">${p.tongue || ''}</span></div>
    <div class="tooltip__ex"><strong>Examples:</strong> ${ex || '—'}</div>
    ${artCue}
  `;
  tip.setAttribute('data-show', '1');
  tip.setAttribute('aria-hidden', 'false');
}

function moveTooltip(x, y) {
  const pad = 14;
  const w = tip.offsetWidth || 260;
  const h = tip.offsetHeight || 60;
  const nx = Math.min(window.innerWidth - w - pad, x + 12);
  const ny = Math.min(window.innerHeight - h - pad, y + 12);
  tip.style.left = `${Math.max(pad, nx)}px`;
  tip.style.top = `${Math.max(pad, ny)}px`;
}

function hideTooltip() {
  tip.removeAttribute('data-show');
  tip.setAttribute('aria-hidden', 'true');
}

function applySearch(q) {
  state.searchQuery = normalizeQuery(q);
  if (!state.searchQuery) return;

  // Try by key/ipa/display first
  for (const p of state.phonemes) {
    if (
      normalizeQuery(p.key) === state.searchQuery ||
      normalizeQuery(p.ipa) === state.searchQuery ||
      normalizeQuery(p.display) === state.searchQuery
    ) {
      setSelected(p.key);
      return;
    }
  }

  // Try examples
  for (const p of state.phonemes) {
    if ((p.example || []).some((w) => w.toLowerCase().includes(state.searchQuery))) {
      setSelected(p.key);
      return;
    }
  }
}

function syncCompareDropdowns() {
  const selA = $('#compareSelectA');
  const selB = $('#compareSelectB');
  if (selA) selA.value = state.compareA;
  if (selB) selB.value = state.compareB;
}

function initCompareControls() {
  const selA = $('#compareSelectA');
  const selB = $('#compareSelectB');

  if (selA && selB) {
    selA.innerHTML = '';
    selB.innerHTML = '';

    state.phonemes.forEach((p) => {
      const optA = el('option', { value: p.key }, `/${p.ipa}/ — ${(p.example || [])[0] || p.tongue}`);
      const optB = el('option', { value: p.key }, `/${p.ipa}/ — ${(p.example || [])[0] || p.tongue}`);
      selA.appendChild(optA);
      selB.appendChild(optB);
    });

    selA.value = state.compareA;
    selB.value = state.compareB;

    selA.addEventListener('change', (e) => {
      state.compareA = e.target.value;
      renderAll();
    });

    selB.addEventListener('change', (e) => {
      state.compareB = e.target.value;
      renderAll();
    });
  }

  const swapBtn = $('#compareSwapBtn');
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      const tmp = state.compareA;
      state.compareA = state.compareB;
      state.compareB = tmp;
      syncCompareDropdowns();
      renderAll();
    });
  }

  const playBoth = $('#playBothBtn');
  if (playBoth) {
    playBoth.addEventListener('click', () => {
      const pA = state.byKey.get(state.compareA);
      const pB = state.byKey.get(state.compareB);
      if (pA && pB) playCompareSequence(pA, pB);
    });
  }

  // Preset buttons
  $$('.btnPreset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [k1, k2] = btn.getAttribute('data-pair').split(',');
      if (k1 && k2) {
        state.compareA = k1;
        state.compareB = k2;
        syncCompareDropdowns();
        renderAll();
      }
    });
  });

  // Toggle compare mode
  const toggleBtn = $('#toggleCompareBtn');
  const compareSec = $('#compareSection');
  if (toggleBtn && compareSec) {
    toggleBtn.addEventListener('click', () => {
      state.compareMode = !state.compareMode;
      toggleBtn.classList.toggle('is-active', state.compareMode);
      toggleBtn.setAttribute('aria-pressed', String(state.compareMode));
      compareSec.classList.toggle('is-hidden', !state.compareMode);

      $$('.compareOnly').forEach((el) => el.classList.toggle('is-hidden', !state.compareMode));

      renderAll();
    });
  }
}

function initFilterChips() {
  $$('.filterChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('.filterChips .chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');

      state.activeFilter = chip.getAttribute('data-filter') || 'all';
      renderTileChart();
      renderTable();
      syncHighlights();
    });
  });
}

function initAnatomyControls() {
  $$('.segBtn[data-anatomy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.segBtn[data-anatomy]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      state.anatomyMode = btn.getAttribute('data-anatomy') || 'subtle';
      renderTileChart();
      syncHighlights();
    });
  });

  const glideBtn = $('#toggleGlidesBtn');
  if (glideBtn) {
    glideBtn.addEventListener('click', () => {
      state.showGlides = !state.showGlides;
      glideBtn.classList.toggle('is-active', state.showGlides);
      glideBtn.setAttribute('aria-pressed', String(state.showGlides));
      renderTileChart();
      syncHighlights();
    });
  }
}

async function load() {
  const res = await fetch('./data/phonemes.json');
  const json = await res.json();

  state.phonemes = json.phonemes || [];
  state.byKey = new Map(state.phonemes.map((p) => [p.key, p]));

  // Initial selection
  state.selected = state.phonemes[0]?.key || null;

  initCompareControls();
  initFilterChips();
  initAnatomyControls();

  renderAll();

  // Re-render chart on resize
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

  // Keyboard navigation across vowel quadrilateral
  window.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

    const keys = CHART_NODE_KEYS;
    const currIdx = keys.indexOf(state.selected);

    if (e.key === 'ArrowRight') {
      const nextKey = keys[(currIdx + 1) % keys.length];
      setSelected(nextKey);
    } else if (e.key === 'ArrowLeft') {
      const prevKey = keys[(currIdx - 1 + keys.length) % keys.length];
      setSelected(prevKey);
    }
  });
}

function renderAll() {
  renderTileChart();
  renderTable();
  renderDetails();
  syncHighlights();
}

load();
