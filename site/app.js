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

function renderTileChart(){
  const root = $('#tileChart');
  root.innerHTML = '';

  const stage = el('div', { class:'tileStage', role:'application', 'aria-label':'Vowel mouth diagram (tile map)' });
  root.appendChild(stage);

  // Map from vowel quadrilateral coords (520x360) into stage box.
  const W = 520, H = 360;
  const rect = stage.getBoundingClientRect();
  const sx = (rect.width || W) / W;
  const sy = (rect.height || H) / H;

  const items = [];

  for (const p of state.phonemes){
    const wide = p.tile?.w===2 ? 92 : p.tile?.w===3 ? 140 : 44;
    const baseH = 56;

    // Prefer quad-based positioning so it forms a mouth/vowel-diagram shape.
    const x = p.quad?.x ?? ((p.tile?.c || 1) * 44);
    const y = p.quad?.y ?? ((p.tile?.r || 1) * 56);

    const desiredLeft = (x * sx) - (wide/2);
    const desiredTop  = (y * sy) - (baseH/2);

    const tile = el('div', {
      class: `tile ${p.tile?.w===2?'tile--wide':''} ${p.tile?.w===3?'tile--wide2':''}`,
      role:'button',
      tabindex:'0',
      'data-key': p.key,
      style: `left:${desiredLeft.toFixed(2)}px; top:${desiredTop.toFixed(2)}px; height:${baseH}px; width:${wide}px;`
    },
      el('div', { class:'tile__top' }, p.display),
      el('button', { class:'tile__play', type:'button', 'aria-label':`Play /${p.ipa}/`, onClick:(e)=>{ e.stopPropagation(); playPhoneme(p).catch(()=>{}); } }, '▶'),
      el('div', { class:'tile__bot' },
        ...(state.showLabels ? (p.example||[]).slice(0,4).map(w => el('div', {}, w)) : [])
      )
    );

    wireInteractive(tile, p);
    stage.appendChild(tile);
    items.push({ p, tile, w: wide, h: baseH, desiredLeft, desiredTop });
  }

  // Collision avoidance for better UX (simple packing).
  // Strategy: place from top to bottom; if overlap detected, nudge downward / sideways.
  const PAD = 6;
  const placed = [];

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function rectFor(left, top, w, h){ return { left, top, right:left+w, bottom:top+h, w, h }; }
  function overlaps(a, b){
    return !(a.right + PAD <= b.left || a.left >= b.right + PAD || a.bottom + PAD <= b.top || a.top >= b.bottom + PAD);
  }

  items.sort((a,b) => (a.desiredTop - b.desiredTop) || (a.desiredLeft - b.desiredLeft));

  const stageW = rect.width || W;
  const stageH = rect.height || H;

  for (const it of items){
    let left = it.desiredLeft;
    let top = it.desiredTop;

    // keep inside bounds initially
    left = clamp(left, 0, Math.max(0, stageW - it.w));
    top  = clamp(top,  0, Math.max(0, stageH - it.h));

    let r = rectFor(left, top, it.w, it.h);
    let tries = 0;
    while (placed.some(o => overlaps(r, o)) && tries < 160){
      // alternate side nudges while trending downward
      const stepY = 6;
      const stepX = 8;
      top = clamp(top + stepY, 0, Math.max(0, stageH - it.h));
      const dir = (tries % 2 === 0) ? 1 : -1;
      left = clamp(left + dir * stepX, 0, Math.max(0, stageW - it.w));
      r = rectFor(left, top, it.w, it.h);
      tries++;
      // if we're stuck at bottom, try scanning horizontally
      if (top >= stageH - it.h && tries % 20 === 0){
        left = clamp((tries * 13) % Math.max(1, stageW - it.w), 0, Math.max(0, stageW - it.w));
        r = rectFor(left, top, it.w, it.h);
      }
    }

    it.tile.style.left = `${left.toFixed(2)}px`;
    it.tile.style.top  = `${top.toFixed(2)}px`;
    placed.push(r);
  }
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
  const root = $('#quadPoints');
  root.innerHTML = '';

  // Coordinates are in SVG viewBox space; we map to the overlay div.
  // Overlay div is same aspect as 520x360 by CSS (via fixed height), so we can scale.
  const W = 520, H = 360;

  const rect = root.getBoundingClientRect();
  const sx = rect.width / W;
  const sy = rect.height / H;

  for (const p of state.phonemes){
    if (!p.quad) continue;
    const pt = el('div', {
      class:'point',
      'data-key': p.key,
      style: `left:${(p.quad.x*sx).toFixed(2)}px; top:${(p.quad.y*sy).toFixed(2)}px;`
    }, state.showLabels ? p.display : '•');

    wireInteractive(pt, p);
    root.appendChild(pt);
  }
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

async function canFetch(url){
  try{
    const r = await fetch(url, { method:'HEAD' });
    return r.ok;
  } catch { return false; }
}

let audio;
function ensureAudio(){
  if (!audio) audio = new Audio();
  return audio;
}

async function playUrl(url){
  const a = ensureAudio();
  a.pause();
  a.currentTime = 0;
  a.src = url;
  await a.play();
}

function playPhoneme(p){
  const url = audioUrlForPhoneme(p);
  return playUrl(url);
}

function playButton(label, url, enabled){
  const btn = el('button', { class:`play ${enabled ? '' : 'is-disabled'}`, type:'button', 'aria-label': label });
  btn.textContent = enabled ? `▶ ${label}` : `⏸ ${label}`;
  if (!enabled) btn.disabled = true;
  btn.addEventListener('click', async () => {
    try{ await playUrl(url); }
    catch(err){ console.warn('Audio play failed', err); }
  });
  return btn;
}

async function renderDetails(){
  const root = $('#details');
  const p = state.selected ? state.byKey.get(state.selected) : null;

  if (!p){
    root.innerHTML = '<div class="card__empty">Select a vowel to see details.</div>';
    return;
  }

  const examples = (p.example||[]);
  const phonemeAudio = audioUrlForPhoneme(p);
  const phonemeHas = await canFetch(phonemeAudio);

  // Pre-check word audio existence (first few to avoid hammering)
  const wordChecks = await Promise.all(examples.slice(0,6).map(async w => [w, audioUrlForWord(w), await canFetch(audioUrlForWord(w))]));

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
      playButton(`/${p.ipa}/`, phonemeAudio, phonemeHas)
    )
  ));

  root.appendChild(el('div', { class:'card__section' },
    el('h3', {}, 'Examples'),
    examples.length
      ? el('ul', { class:'card__list' },
          ...examples.map(w => {
            const found = wordChecks.find(x => x[0]===w);
            const url = found ? found[1] : audioUrlForWord(w);
            const ok = found ? found[2] : false;
            return el('li', {},
              el('span', { class:'exWord' }, w),
              ' ',
              playButton(w, url, ok)
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
  // async renderDetails()
  renderDetails();
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

  // Re-render quad + tile chart on resize for scaling
  window.addEventListener('resize', () => {
    renderTileChart();
    renderQuad();
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
