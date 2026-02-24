const $ = (sel, root=document) => root.querySelector(sel);

const state = {
  phonemes: [],
  byKey: new Map(),
  selected: null,
  hover: null,
  showLabels: true,
};

function normalizeQuery(q){
  return (q||"")
    .trim()
    .toLowerCase()
    .replace(/^\//,'')
    .replace(/\/$/,'');
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
  const svg = svgEl('svg', { class:'stageSvg', viewBox:'0 0 520 360', 'aria-label':'Vowel quadrilateral diagram' });

  svg.appendChild(svgEl('path', {
    class: 'guide',
    d:'M 90 40 L 420 40 L 360 300 L 150 300 Z',
    fill:'none',
    stroke:'rgba(17,24,39,.85)',
    'stroke-width':'2.25'
  }));

  [
    ['105','120','410','120'],
    ['120','200','395','200'],
    ['220','40','205','300'],
    ['320','40','300','300']
  ].forEach(([x1,y1,x2,y2]) => {
    svg.appendChild(svgEl('line', {
      class: 'guide',
      x1, y1, x2, y2,
      stroke:'rgba(75,85,99,.35)',
      'stroke-width':'1.7'
    }));
  });

  [
    ['78', '30', 'Close'],
    ['78', '130', 'Mid'],
    ['78', '312', 'Open'],
    ['155', '24', 'Front'],
    ['250', '24', 'Central'],
    ['350', '24', 'Back']
  ].forEach(([x,y,t]) => svg.appendChild(svgEl('text', { x, y, class:'quad__label' }, t)));

  for (const p of state.phonemes){
    const x = p.quad?.x ?? ((p.tile?.c || 1) * 44);
    const y = p.quad?.y ?? ((p.tile?.r || 1) * 56);

    const node = svgEl('g', {
      class:'vowel-node',
      role:'button',
      tabindex:'0',
      transform:`translate(${x} ${y})`,
      'data-key': p.key
    });

    node.appendChild(svgEl('circle', { class:'vowel-node__dot', cx:'0', cy:'0', r:'11' }));

    if (state.showLabels) {
      node.appendChild(svgEl('text', { class:'vowel-node__ipa', x:'0', y:'1.5' }, p.display || p.ipa));
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

  root.appendChild(el('div', { class:'card__row' },
    el('span', { class:'badge' }, 'IPA ', el('code', {}, p.ipa)),
    el('span', { class:'badge' }, 'Type ', el('code', {}, p.type || '—')),
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
  // Tiles
  document.querySelectorAll('[data-key]').forEach(node => {
    const k = node.getAttribute('data-key');
    node.classList.toggle('is-hover', !!state.hover && state.hover === k);
    node.classList.toggle('is-selected', !!state.selected && state.selected === k);
  });

  // Table rows need a slightly different selector
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
