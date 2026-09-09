const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  phonemes: [],
  byKey: new Map(),
  selected: null,
  hover: null,
  showLabels: true,
  showWords: true,
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

// Enlarged diagram coordinate system (600 x 420)
const DIAGRAM = {
  viewBox: { w: 600, h: 420 },
  quad: {
    tl: { x: 105, y: 46 },
    tr: { x: 495, y: 46 },
    br: { x: 425, y: 350 },
    bl: { x: 175, y: 350 }
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

const ANCHOR_WORDS = {
  'i': 'be',
  'ɪ': 'sit',
  'ɝ': 'bird',
  'ɚ': 'actor',
  'u': 'shoe',
  'ʊ': 'foot',
  'eɪ': 'day',
  'ɛ': 'bed',
  'ʌ': 'sun',
  'ə': 'ago',
  'oʊ': 'no',
  'ɔ': 'dog',
  'æ': 'hat',
  'ɑ': 'sky',
  'ɑ2': 'top'
};

// Generously spaced slots with zero overlap between symbols or anchor words
const CHART_SHEET = {
  'i':  { row: 'high', col: 'front',   u: 0.46, v: 0.16 },
  'ɪ':  { row: 'high', col: 'front',   u: 0.62, v: 0.62 },
  'ɝ':  { row: 'high', col: 'central', u: 0.28, v: 0.25 },
  'ɚ':  { row: 'high', col: 'central', u: 0.72, v: 0.25 },
  'u':  { row: 'high', col: 'back',    u: 0.54, v: 0.16 },
  'ʊ':  { row: 'high', col: 'back',    u: 0.54, v: 0.64 },

  'eɪ': { row: 'mid',  col: 'front',   u: 0.44, v: 0.20 },
  'ɛ':  { row: 'mid',  col: 'front',   u: 0.54, v: 0.78 },
  'ʌ':  { row: 'mid',  col: 'central', u: 0.25, v: 0.62 },
  'ə':  { row: 'mid',  col: 'central', u: 0.75, v: 0.38 },
  'oʊ': { row: 'mid',  col: 'back',    u: 0.44, v: 0.20 },
  'ɔ':  { row: 'mid',  col: 'back',    u: 0.44, v: 0.78 },

  'æ':  { row: 'low',  col: 'front',   u: 0.48, v: 0.32 },
  'ɑ':  { row: 'low',  col: 'front',   u: 0.72, v: 0.82 },
  'ɑ2': { row: 'low',  col: 'back',    u: 0.48, v: 0.76 }
};

// Tongue contours scaled to 600x420 viewBox
const TONGUE_POSTURES = {
  'high-front': `M 88 168 C 102 134 122 75 168 70 C 220 64 278 102 325 156 C 382 208 424 278 424 330 C 418 362 390 378 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`,
  'mid-front':  `M 88 168 C 106 150 140 125 180 122 C 232 116 284 145 330 184 C 382 226 424 284 424 330 C 418 362 390 378 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`,
  'low-front':  `M 88 172 C 116 176 162 198 208 215 C 255 232 302 250 348 260 C 395 272 424 302 424 330 C 418 362 390 378 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`,
  'high-back':  `M 88 168 C 116 168 156 174 208 174 C 268 174 325 122 382 82 C 424 60 450 78 444 136 C 436 220 430 290 424 330 C 418 362 390 378 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`,
  'mid-back':   `M 88 168 C 116 168 162 174 215 180 C 272 186 325 162 382 150 C 420 145 438 174 434 222 C 428 272 426 308 424 330 C 418 362 390 378 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`,
  'low-back':   `M 88 172 C 122 174 174 186 226 210 C 278 232 330 244 378 250 C 412 255 430 284 428 318 C 424 342 400 370 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`,
  'rhotic':     `M 88 168 C 110 142 140 98 174 92 C 204 86 238 125 284 106 C 330 90 378 122 406 172 C 428 220 428 284 424 330 C 418 362 390 378 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`,
  'central':    `M 88 168 C 110 162 145 145 192 140 C 250 134 308 145 354 168 C 400 198 430 255 424 325 C 418 360 390 378 366 380 C 278 368 186 336 128 278 C 100 232 88 192 88 168 Z`
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

  // Partition angles optimized for balanced column distribution
  const frontTop = {
    x: lerp(DIAGRAM.quad.tl.x, DIAGRAM.quad.tr.x, 0.33),
    y: lerp(DIAGRAM.quad.tl.y, DIAGRAM.quad.tr.y, 0.33)
  };
  const frontBottom = {
    x: lerp(DIAGRAM.quad.bl.x, DIAGRAM.quad.br.x, 0.42),
    y: lerp(DIAGRAM.quad.bl.y, DIAGRAM.quad.br.y, 0.42)
  };

  const backTop = {
    x: lerp(DIAGRAM.quad.tl.x, DIAGRAM.quad.tr.x, 0.68),
    y: lerp(DIAGRAM.quad.tl.y, DIAGRAM.quad.tr.y, 0.68)
  };
  const backBottom = {
    x: lerp(DIAGRAM.quad.bl.x, DIAGRAM.quad.br.x, 0.70),
    y: lerp(DIAGRAM.quad.bl.y, DIAGRAM.quad.br.y, 0.70)
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
  if (p.quad?.x != null && p.quad?.y != null) {
    // Scale older quad coordinates if present
    return { x: p.quad.x * (600 / 520), y: p.quad.y * (420 / 360) };
  }
  return { x: 300, y: 210 };
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

function resolvePostureKey(p) {
  if (!p) return 'central';
  const t = normalizeTongueLabel(p.tongue || '');
  if (p.rhotic || t.includes('+r')) return 'rhotic';
  if (t.includes('high-front')) return 'high-front';
  if (t.includes('mid-front')) return 'mid-front';
  if (t.includes('low-front')) return 'low-front';
  if (t.includes('high-back')) return 'high-back';
  if (t.includes('mid-back')) return 'mid-back';
  if (t.includes('low-back')) return 'low-back';
  return 'central';
}

function resolveLipIcon(lips = '') {
  const l = String(lips || '').toLowerCase();
  if (l.includes('round') && !l.includes('unround')) {
    return `
      <svg viewBox="0 0 20 12" class="lipIcon lipIcon--round" aria-label="Rounded lips">
        <ellipse cx="10" cy="6" rx="8" ry="5" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <ellipse cx="10" cy="6" rx="3.5" ry="2.5" fill="currentColor"/>
      </svg>
    `;
  }
  if (l.includes('unround')) {
    return `
      <svg viewBox="0 0 20 12" class="lipIcon lipIcon--spread" aria-label="Unrounded spread lips">
        <path d="M 2 6 Q 10 1.5 18 6 Q 10 10.5 2 6 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <line x1="4" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 20 12" class="lipIcon lipIcon--neutral" aria-label="Neutral lips">
      <path d="M 3 6 Q 10 3.5 17 6 Q 10 8.5 3 6 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
    </svg>
  `;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'innerHTML') node.innerHTML = v;
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
   VOCAL TRACT SAGITTAL ANATOMY DRAWING (Scaled for 600 x 420)
   ========================================================================== */
function drawVocalTractAnatomy(svg) {
  if (state.anatomyMode === 'off') return;

  const g = svgEl('g', {
    class: `vocal-tract-layer vocal-tract-layer--${state.anatomyMode}`,
    'aria-hidden': 'true'
  });

  // Tissue background
  g.appendChild(svgEl('path', {
    class: 'vt-tissue',
    d: `
      M 34 36
      C 26 65 14 88 10 106
      C 20 112 28 120 16 134
      C 25 145 28 152 18 166
      C 30 192 26 226 28 245
      C 36 295 86 330 160 365
      C 242 392 335 406 422 408
      C 475 408 522 382 545 336
      C 568 278 565 140 556 58
      C 532 24 464 14 372 14
      Z
    `
  }));

  // Facial Profile facing Left
  g.appendChild(svgEl('path', {
    class: 'vt-profile',
    d: `
      M 38 24
      C 30 52 18 84 10 102
      C 18 110 26 118 16 132
      C 25 142 30 148 18 162
      C 30 192 28 218 26 240
      C 32 284 70 324 134 360
      C 192 385 284 406 372 412
    `
  }));

  // Lips Vermilion
  g.appendChild(svgEl('path', {
    class: 'vt-lips',
    d: `
      M 28 122 C 16 132 16 136 30 142
      M 28 158 C 18 162 20 170 30 170
    `
  }));

  // Teeth
  g.appendChild(svgEl('polygon', {
    class: 'vt-teeth',
    points: '74,120 86,122 84,142 76,142'
  }));
  g.appendChild(svgEl('polygon', {
    class: 'vt-teeth',
    points: '78,160 85,160 84,176 77,176'
  }));

  // Hard Palate & Alveolar Ridge
  g.appendChild(svgEl('path', {
    class: 'vt-palate',
    d: `
      M 75 120
      C 76 98 90 64 106 46
      C 134 32 232 28 325 32
      C 390 36 445 50 480 80
      C 490 90 490 104 482 106
      C 475 108 470 96 462 84
      C 432 64 380 54 315 48
    `
  }));

  // Pharyngeal Wall
  g.appendChild(svgEl('path', {
    class: 'vt-pharynx',
    d: `
      M 508 32
      C 522 50 530 88 528 140
      C 525 210 510 285 482 342
      C 458 378 436 398 422 412
    `
  }));

  // Mandible
  g.appendChild(svgEl('path', {
    class: 'vt-mandible',
    d: `
      M 78 176
      C 86 220 114 285 168 332
      C 226 366 296 384 372 394
      C 395 394 408 405 414 412
    `
  }));

  // Dynamic Morphing Tongue Posture
  const activeKey = state.hover || state.selected;
  const activeP = state.byKey.get(activeKey);
  const postureKey = resolvePostureKey(activeP);
  const tongueD = TONGUE_POSTURES[postureKey] || TONGUE_POSTURES.central;

  g.appendChild(svgEl('path', {
    id: 'dynamicTongue',
    class: 'vt-tongue vt-tongue--active',
    d: tongueD
  }));

  // Larynx
  g.appendChild(svgEl('path', {
    class: 'vt-larynx',
    d: `
      M 418 368 C 425 376 427 388 418 400
      M 408 384 L 428 384
    `
  }));

  // Speaker Orientation Indicator
  const compass = svgEl('g', { class: 'vt-compass', transform: 'translate(36, 400)' });
  compass.appendChild(svgEl('text', { class: 'vt-compass__text', x: '0', y: '0' }, '🗣 Facing LEFT (Lips/Teeth)'));
  g.appendChild(compass);

  // Anatomical Callout Labels
  const callouts = [
    { x: 50, y: 88, label: 'LIPS & TEETH', sub: '(Front)', anchor: 'middle' },
    { x: 205, y: 20, label: 'HARD PALATE', sub: '(Roof / High)', anchor: 'middle' },
    { x: 515, y: 20, label: 'VELUM & THROAT', sub: '(Soft Palate / Back)', anchor: 'end' },
    { x: 300, y: 400, label: 'OPEN JAW & FLOOR', sub: '(Low / Depressed)', anchor: 'middle' }
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
      y: y + 11,
      'text-anchor': anchor
    }, sub));
    g.appendChild(textGroup);
  });

  // Vertical Jaw Drop Caliper along the High-Mid-Low Axis
  const caliperGroup = svgEl('g', { class: 'jaw-caliper', 'aria-label': 'Jaw opening gauge' });

  // High Caliper bracket: ~2mm
  caliperGroup.appendChild(svgEl('path', { class: 'caliper-bracket', d: 'M 58 80 L 50 80 L 50 114 L 58 114' }));
  caliperGroup.appendChild(svgEl('text', { class: 'caliper-label', x: '47', y: '100', 'text-anchor': 'end' }, '1-2mm (Closed)'));

  // Mid Caliper bracket: ~12mm (1 finger)
  caliperGroup.appendChild(svgEl('path', { class: 'caliper-bracket', d: 'M 58 200 L 50 200 L 50 238 L 58 238' }));
  caliperGroup.appendChild(svgEl('text', { class: 'caliper-label', x: '47', y: '222', 'text-anchor': 'end' }, '1 finger (~12mm)'));

  // Low Caliper bracket: ~22mm (2 fingers)
  caliperGroup.appendChild(svgEl('path', { class: 'caliper-bracket', d: 'M 65 325 L 57 325 L 57 365 L 65 365' }));
  caliperGroup.appendChild(svgEl('text', { class: 'caliper-label', x: '54', y: '348', 'text-anchor': 'end' }, '2 fingers (~22mm)'));

  g.appendChild(caliperGroup);

  svg.appendChild(g);
}

function drawSlotGrid(svg) {
  const g = getDiagramGuides();

  [g.mid, g.low].forEach(({ left, right }) => {
    svg.appendChild(svgEl('line', {
      class: 'slot-grid-line',
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y
    }));
  });

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

    group.appendChild(svgEl('circle', {
      class: 'glide-pulse-dot',
      cx: p1.x,
      cy: p1.y,
      r: '6',
      fill: '#e11d48'
    }));

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

  // Acoustic Resonance Heatmap Gradient
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', {
    id: 'acousticGradient',
    x1: '0%',
    y1: '0%',
    x2: '100%',
    y2: '0%'
  });
  grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#0284c7', 'stop-opacity': '0.12' }));
  grad.appendChild(svgEl('stop', { offset: '50%', 'stop-color': '#8b5cf6', 'stop-opacity': '0.04' }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#f43f5e', 'stop-opacity': '0.14' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Layer 1: Anatomical Vocal Tract Cross Section
  drawVocalTractAnatomy(svg);

  // Layer 2: Quadrilateral Boundary with Acoustic resonance tint
  svg.appendChild(svgEl('path', {
    class: 'guide',
    d: `M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`,
    fill: 'url(#acousticGradient)',
    stroke: 'rgba(17,24,39,.85)',
    'stroke-width': '2.25'
  }));

  // Layer 3: Grid Partitions
  drawSlotGrid(svg);

  // Axis Labels
  [
    { x: 175, y: 34, text: 'Front', cls: 'quad__label quad__label--zone' },
    { x: 295, y: 34, text: 'Central', cls: 'quad__label quad__label--zone' },
    { x: 415, y: 34, text: 'Back', cls: 'quad__label quad__label--zone' },

    { x: 74, y: 95, text: 'High', cls: 'quad__label quad__label--axis' },
    { x: 74, y: 220, text: 'Mid', cls: 'quad__label quad__label--axis' },
    { x: 82, y: 345, text: 'Low', cls: 'quad__label quad__label--axis' },

    { x: 528, y: 95, text: 'High', cls: 'quad__label quad__label--axis' },
    { x: 528, y: 220, text: 'Mid', cls: 'quad__label quad__label--axis' },
    { x: 535, y: 345, text: 'Low', cls: 'quad__label quad__label--axis' }
  ].forEach(({ x, y, text, cls }) => svg.appendChild(svgEl('text', { x, y, class: cls }, text)));

  // Layer 4: Glide Trajectories & Compare Vectors
  drawGlideTrajectories(svg);
  drawCompareVector(svg);

  // Layer 5: Phoneme Nodes with Anchor Words & Lip Indicators
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

    const isRounded = String(p.lips || '').toLowerCase().includes('round') && !String(p.lips || '').toLowerCase().includes('unround');

    node.appendChild(svgEl('circle', {
      class: `vowel-node__dot ${isRounded ? 'vowel-node__dot--rounded' : ''}`,
      cx: '0',
      cy: '0',
      r: '12'
    }));

    if (state.showLabels) {
      const label = CHART_LABEL_OVERRIDES[p.key] || p.display || p.ipa;
      node.appendChild(svgEl('text', { class: 'vowel-node__ipa', x: '0', y: '1.5' }, label));
    }

    // Anchor word badge cleanly centered below node with white text halo
    if (state.showWords) {
      const anchorWord = ANCHOR_WORDS[p.key] || (p.example || [])[0] || '';
      if (anchorWord) {
        node.appendChild(svgEl('text', { class: 'vowel-node__word', x: '0', y: '20' }, anchorWord));
      }
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

    const lipIconHtml = resolveLipIcon(p.lips);

    const tr = el('tr', { 'data-key': p.key, class: trClasses.join(' ') },
      el('td', {},
        el('code', { class: 'sym-code' }, `/${p.ipa}/`),
        isCompA ? el('span', { class: 'badge badge--a' }, 'A') : null,
        isCompB ? el('span', { class: 'badge badge--b' }, 'B') : null
      ),
      el('td', {}, (p.example || []).join(', ')),
      el('td', {}, p.tongue || ''),
      el('td', {},
        el('span', { class: 'lipCell', innerHTML: `${lipIconHtml} <span>${p.lips || ''}</span>` })
      ),
      el('td', {}, p.length || p.type || '')
    );

    tr.addEventListener('mouseenter', () => setHover(p.key));
    tr.addEventListener('mouseleave', () => setHover(null));
    tr.addEventListener('click', () => {
      if (state.compareMode) {
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

  const lipIconHtml = resolveLipIcon(p.lips);

  // Top header with symbol + display name
  const header = el('div', { class: 'card__header' },
    el('div', { class: 'card__sym' }, `/${p.ipa}/`),
    el('div', { class: 'card__meta' },
      el('div', { class: 'card__type' }, p.tongue || p.type || 'Monophthong'),
      el('div', { class: 'card__badges' },
        el('span', { class: 'badge' }, 'IPA: ', el('code', {}, p.ipa)),
        el('span', { class: 'badge', innerHTML: `Lips: ${lipIconHtml} <strong>${p.lips || 'unrounded'}</strong>` }),
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
        el('div', { class: 'artItem__title', innerHTML: `👄 Lip Posture & Aperture ${lipIconHtml}` }, ''),
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
    }, '▶ Play Sequence')
  );
  root.appendChild(compHeader);

  const columns = el('div', { class: 'compareColumns' },
    // Col A
    el('div', { class: 'compCol compCol--a' },
      el('div', { class: 'compCol__head' },
        el('span', { class: 'badge badge--a' }, 'Vowel A'),
        el('span', { class: 'compSym' }, `/${pA.ipa}/`)
      ),
      el('div', { class: 'compProp' }, el('strong', {}, 'Tongue: '), pA.tongue || '—'),
      el('div', { class: 'compProp', innerHTML: `<strong>Lips:</strong> ${resolveLipIcon(pA.lips)} ${pA.lips || '—'}` }),
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
      el('div', { class: 'compProp', innerHTML: `<strong>Lips:</strong> ${resolveLipIcon(pB.lips)} ${pB.lips || '—'}` }),
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

  renderTileChart();

  const p = state.byKey.get(key);
  if (p) {
    primeAudio(audioUrlForPhoneme(p));
    (p.example || []).slice(0, 4).forEach((w) => primeAudio(audioUrlForWord(w)));
  }
}

function setHover(key) {
  state.hover = key;
  syncHighlights();

  const activeP = state.byKey.get(key || state.selected);
  const tongueEl = $('#dynamicTongue');
  if (tongueEl && activeP) {
    const postureKey = resolvePostureKey(activeP);
    const newD = TONGUE_POSTURES[postureKey] || TONGUE_POSTURES.central;
    tongueEl.setAttribute('d', newD);
  }
}

function syncHighlights() {
  document.querySelectorAll('.stageSvg [data-key]').forEach((node) => {
    const k = node.getAttribute('data-key');
    const isDirectHover = !!state.hover && state.hover === k;
    const isDirectSelected = !!state.selected && state.selected === k;

    node.classList.toggle('is-hover', isDirectHover);
    node.classList.toggle('is-selected', isDirectSelected);
  });

  document.querySelectorAll('#refTable tbody tr').forEach((tr) => {
    const k = tr.getAttribute('data-key');
    tr.classList.toggle('is-selected', !!state.selected && state.selected === k);
  });
}

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

  state.selected = state.phonemes[0]?.key || null;

  initCompareControls();
  initFilterChips();
  initAnatomyControls();

  renderAll();

  window.addEventListener('resize', () => {
    renderTileChart();
    syncHighlights();
  });

  $('#toggleLabels').addEventListener('change', (e) => {
    state.showLabels = !!e.target.checked;
    renderAll();
  });

  const toggleWordsEl = $('#toggleWords');
  if (toggleWordsEl) {
    toggleWordsEl.addEventListener('change', (e) => {
      state.showWords = !!e.target.checked;
      renderAll();
    });
  }

  $('#search').addEventListener('input', (e) => applySearch(e.target.value));

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
