import { MANNERS, initialConsonantState, reduceConsonants, filterConsonants, groupConsonants, wordParts, modeFromHash, modeForKey } from './consonant-state.js';

// No top-level browser effects: the media lifecycle is testable in Node.
export function createWordPlayer({ createAudio = url => new Audio(url), onStatus = () => {} } = {}) {
  let generation = 0;
  let active = null;
  function stop() {
    generation++;
    if (active) {
      active.onended = active.onerror = null;
      active.pause();
      active.currentTime = 0;
      active = null;
    }
    onStatus({ kind: 'idle' });
  }
  async function play(url, word, rate = 1) {
    stop();
    const token = generation;
    let clip;
    const current = () => token === generation;
    const finish = kind => {
      if (!current()) return;
      generation++;
      if (clip) {
        clip.onended = clip.onerror = null;
        clip.pause();
      }
      active = null;
      onStatus({ kind, word });
    };
    try {
      clip = createAudio(url);
      active = clip;
      clip.preload = 'none';
      clip.playbackRate = rate;
      clip.preservesPitch = true;
      clip.onended = () => finish('ended');
      clip.onerror = () => finish('error');
      onStatus({ kind: 'loading', word });
      // Call play synchronously inside the user gesture, even before media loads.
      await clip.play();
      if (!current()) { clip.pause(); return; }
      onStatus({ kind: 'playing', word });
    } catch {
      finish('error');
    }
  }
  return { play, stop };
}

export function initModeTabs({ document: doc = document, window: win = window, onChange = () => {} } = {}) {
  const modes = ['vowels', 'consonants'];
  let activeMode;
  function activate(mode, focus = false, updateHash = false) {
    const nextTab = doc.getElementById(`${mode}Tab`);
    // History navigation must not strand focus inside a newly hidden panel.
    const oldPanel = doc.getElementById(`${mode === 'vowels' ? 'consonants' : 'vowels'}Panel`);
    const controls = doc.getElementById('vowelControls');
    const moveFocus = focus || oldPanel.contains(doc.activeElement) || (mode === 'consonants' && controls.contains(doc.activeElement));
    for (const name of modes) {
      const selected = name === mode;
      const tab = doc.getElementById(`${name}Tab`);
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      doc.getElementById(`${name}Panel`).hidden = !selected;
    }
    controls.hidden = mode !== 'vowels';
    doc.body.dataset.mode = mode;
    if (updateHash && win.location.hash !== `#${mode}`) win.history.pushState(null, '', `#${mode}`);
    if (activeMode !== mode) { activeMode = mode; onChange(mode); }
    if (moveFocus) nextTab.focus();
  }
  for (const mode of modes) {
    const tab = doc.getElementById(`${mode}Tab`);
    tab.addEventListener('click', () => activate(mode, false, true));
    tab.addEventListener('keydown', event => {
      const next = modeForKey(mode, event.key);
      if (next) { event.preventDefault(); activate(next, true, true); }
    });
  }
  win.addEventListener('hashchange', () => activate(modeFromHash(win.location.hash)));
  // pushState does not emit hashchange; Back/Forward does on hash changes.
  activate(modeFromHash(win.location.hash));
}

function element(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  node.append(...children.flat().filter(child => child !== null && child !== undefined));
  return node;
}
const button = (text, onClick, attrs = {}) => element('button', { type: 'button', class: 'c-button', onclick: onClick, ...attrs }, text);
const label = (title, control) => element('label', { class: 'c-field' }, element('span', {}, title), control);
const voiceLabel = p => p.voiced ? 'Voiced' : 'Voiceless';
function highlightedWord(p) {
  const [before, target, after] = wordParts(p);
  return element('span', { class: 'c-word' }, before, element('mark', {}, target), after);
}

export function initConsonants({ onModeChange = () => {} } = {}) {
  const root = document.getElementById('consonantsRoot');
  let state = initialConsonantState();
  let rows = [];
  let list, detail, count, queryInput, mannerSelect, placeSelect, voiceSelect, playbackStatus, stopButton;
  const player = createWordPlayer({ onStatus: status => {
    if (!playbackStatus) return;
    const messages = {
      idle: 'Audio stopped.', loading: `Loading ${status.word}…`, playing: `Playing ${status.word}.`,
      ended: `Finished ${status.word}.`, error: `Couldn't play ${status.word}. Check your connection, then choose Hear ${status.word} to retry.`
    };
    playbackStatus.textContent = messages[status.kind];
    const busy = status.kind === 'loading' || status.kind === 'playing';
    stopButton.disabled = !busy;
    root.querySelectorAll('[data-hear]').forEach(node => {
      const playing = busy && node.dataset.hear === status.word;
      node.classList.toggle('is-playing', playing);
      node.setAttribute('aria-busy', String(playing && status.kind === 'loading'));
    });
  }});
  initModeTabs({ onChange: mode => { player.stop(); onModeChange(mode); } });
  window.addEventListener('pagehide', () => player.stop());
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.stop(); });

  function dispatch(action) { state = reduceConsonants(state, action, rows); }
  function focusDetail() {
    const heading = root.querySelector('#consonantDetailTitle');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function select(key) {
    player.stop();
    dispatch({ type: 'select', key });
    syncSelection();
    renderDetail();
    focusDetail();
  }
  function syncSelection() {
    list.querySelectorAll('[data-consonant]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.consonant === state.selected)));
  }
  function resetFilters() {
    player.stop();
    dispatch({ type: 'reset' });
    queryInput.value = '';
    mannerSelect.value = placeSelect.value = voiceSelect.value = 'all';
    renderList();
    queryInput.focus();
  }
  function renderList() {
    const visible = filterConsonants(rows, state);
    count.textContent = `${visible.length} of ${rows.length} consonants`;
    list.replaceChildren();
    if (!visible.length) {
      list.append(element('div', { class: 'c-empty' }, element('h3', {}, 'No matching consonants'), element('p', {}, 'Try a different word or broaden your filters. Your selected sound is still open in the guide.'), button('Reset search & filters', resetFilters)));
      return;
    }
    for (const group of groupConsonants(visible)) {
      list.append(element('section', { class: 'c-group', 'aria-labelledby': `c-group-${group.key}` },
        element('div', { class: 'c-group-heading' }, element('h3', { id: `c-group-${group.key}` }, group.label), element('span', {}, group.friendly)),
        element('p', { class: 'c-muted' }, group.description),
        element('div', { class: 'c-tiles' }, ...group.items.map(p => button([
          element('span', { class: 'c-tile-top' }, element('span', { class: 'c-ipa' }, `/${p.ipa}/`), highlightedWord(p)),
          element('span', { class: `c-voice ${p.voiced ? 'c-voice--voiced' : ''}` }, voiceLabel(p)),
          element('span', { class: 'c-tile-place' }, p.placeLabel)
        ], () => select(p.key), { class: 'c-tile', 'data-consonant': p.key, 'aria-pressed': String(p.key === state.selected), 'aria-label': `Explore /${p.ipa}/ as in ${p.example[0]}, ${voiceLabel(p).toLowerCase()} ${p.place} ${p.manner}`, 'aria-controls': 'consonantDetail' })))
      ));
    }
  }
  function hear(p) {
    return button(`▶ Hear ${p.example[0]}`, () => player.play(p.audio, p.example[0], state.rate), { class: 'c-button c-hear', 'data-hear': p.example[0] });
  }
  function soundGuide(p, isContrast = false) {
    const manner = MANNERS.find(m => m.key === p.manner);
    return element('article', { class: `c-sound-guide${isContrast ? ' c-sound-guide--contrast' : ''}`, 'aria-label': `${isContrast ? 'Contrast' : 'Selected'} sound /${p.ipa}/` },
      element('div', { class: 'c-guide-head' }, element('span', { class: 'c-guide-ipa' }, `/${p.ipa}/`), element('div', {}, element('div', { class: 'c-eyebrow' }, isContrast ? 'Contrast sound' : 'Selected sound'), highlightedWord(p))),
      element('div', { class: 'c-badges' }, element('span', { class: `c-voice ${p.voiced ? 'c-voice--voiced' : ''}` }, voiceLabel(p)), element('span', {}, `${p.place} · ${p.manner === 'approximant' && p.key === 'l' ? 'lateral approximant' : p.manner}`)),
      hear(p),
      element('h3', {}, 'Mouth position'), element('p', {}, p.mouth),
      element('h3', {}, 'How to make it'), element('ol', {}, ...p.steps.map(step => element('li', {}, step))),
      element('div', { class: 'c-cue' }, element('h3', {}, 'What to feel'), element('p', {}, p.cue)),
      element('div', { class: 'c-mistake' }, element('h3', {}, 'Mistake to avoid'), element('p', {}, p.mistake)),
      element('p', { class: 'c-muted' }, `${manner.friendly} · ${p.placeLabel}`)
    );
  }
  function renderDetail() {
    const p = rows.find(row => row.key === state.selected);
    const other = rows.find(row => row.key === state.compare);
    const counterpart = rows.find(row => row.key === p.counterpart);
    const rateSelect = element('select', { id: 'consonantRate', onchange: event => { player.stop(); dispatch({ type: 'rate', value: Number(event.target.value) }); } }, element('option', { value: '1' }, '1× Normal'), element('option', { value: '0.75' }, '0.75× Slow'));
    rateSelect.value = String(state.rate);
    const comparison = element('select', { id: 'consonantCompare', onchange: event => {
      player.stop(); dispatch({ type: 'compare', key: event.target.value || null }); renderDetail();
      root.querySelector('#consonantCompare').focus({ preventScroll: true });
    } }, element('option', { value: '' }, 'No comparison'), ...rows.filter(row => row.key !== p.key).map(row => element('option', { value: row.key }, `/${row.ipa}/ — ${row.example[0]}`)));
    comparison.value = state.compare || '';
    detail.replaceChildren(
      element('div', { class: 'c-detail-heading' }, element('h2', { id: 'consonantDetailTitle', tabindex: '-1' }, other ? 'Sound contrast' : 'Your pronunciation guide'), button('Back to sounds ↑', () => {
        const tile = Array.from(list.querySelectorAll('[data-consonant]')).find(node => node.dataset.consonant === state.selected);
        (tile || queryInput).focus();
      }, { class: 'c-button c-button--quiet' })),
      element('p', { class: 'c-muted' }, 'Highlighted letters show the target sound. Hear the whole word, not an isolated consonant.'),
      element('div', { class: 'c-listening-tools' }, label('Playback speed', rateSelect), stopButton = button('Stop audio', () => player.stop())),
      playbackStatus = element('p', { class: 'c-audio-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, 'Choose Hear to listen.'),
      element('div', { class: 'c-compare-tools' }, label('Compare with another sound', comparison), counterpart && state.compare !== counterpart.key ? button(`Compare ${voiceLabel(counterpart).toLowerCase()} /${counterpart.ipa}/`, () => {
        player.stop(); dispatch({ type: 'compare', key: counterpart.key }); renderDetail(); focusDetail();
      }, { class: 'c-button c-counterpart' }) : null,
      other ? element('p', { class: 'c-contrast-note' }, p.counterpart === other.key ? 'Same place and manner; notice the change in voicing. These are whole-word sound contrasts, not minimal pairs.' : 'Compare mouth position, airflow, and voicing below. These are whole-word sound contrasts, not minimal pairs.') : !counterpart ? element('p', { class: 'c-muted' }, 'No direct voicing counterpart in the core inventory. Choose any other sound to compare.') : null),
      element('div', { class: 'c-guides' }, soundGuide(p), other ? soundGuide(other, true) : null)
    );
    stopButton.disabled = true;
  }
  function filterControl(id, values, field) {
    return element('select', { id, onchange: event => { player.stop(); dispatch({ type: 'filter', field, value: event.target.value }); renderList(); } }, ...values.map(([value, text]) => element('option', { value }, text)));
  }
  function mount() {
    queryInput = element('input', { id: 'consonantSearch', type: 'search', placeholder: 'Try /θ/, vision, teeth, or voiced nasal…', autocomplete: 'off', oninput: event => {
      player.stop(); dispatch({ type: 'filter', field: 'query', value: event.target.value }); renderList();
    } });
    mannerSelect = filterControl('consonantManner', [['all', 'All manners'], ...MANNERS.map(m => [m.key, `${m.label} — ${m.friendly}`])], 'manner');
    placeSelect = filterControl('consonantPlace', [['all', 'All places'], ...Array.from(new Set(rows.map(p => p.place))).map(place => [place, `${place} — ${rows.find(p => p.place === place).placeLabel}`])], 'place');
    voiceSelect = filterControl('consonantVoice', [['all', 'Both'], ['voiced', 'Voiced'], ['voiceless', 'Voiceless']], 'voice');
    root.replaceChildren(
      element('section', { class: 'c-intro', 'aria-labelledby': 'consonantTitle' }, element('div', {}, element('p', { class: 'c-eyebrow' }, '24 sounds · General American'), element('h1', { id: 'consonantTitle' }, 'Consonants, made clear.'), element('p', {}, 'Explore how your lips, tongue, and voice shape a sound. Choose a card, feel the position, then listen to the word.')), element('div', { class: 'c-voice-tip' }, element('strong', {}, 'Try a gentle throat check'), element('p', {}, 'Voiced sounds use vocal-fold vibration; voiceless sounds do not. Touch your throat lightly to feel the difference. Initial b, d, and g may begin voicing near the release.'))),
      element('section', { class: 'c-filters', 'aria-label': 'Consonant search and filters' }, label('Search sounds or words', queryInput), element('div', { class: 'c-filter-row' }, label('Manner · how air moves', mannerSelect), label('Place · where it happens', placeSelect), label('Voicing', voiceSelect)), element('div', { class: 'c-results-line' }, count = element('p', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }), button('Reset search & filters', resetFilters, { class: 'c-button c-button--quiet' }))),
      element('div', { class: 'c-workspace' }, element('section', { class: 'c-browser', 'aria-label': 'Consonants grouped by manner' }, list = element('div', { id: 'consonantList' })), detail = element('aside', { id: 'consonantDetail', class: 'c-detail', 'aria-labelledby': 'consonantDetailTitle' })),
      element('p', { class: 'c-footnote' }, 'Core phonemes, not every pronunciation variant: American flaps and glottal stops are not additional entries here. /ɹ/ is the English r; /j/ is the y in yes.')
    );
    renderList(); renderDetail();
  }
  async function load() {
    root.replaceChildren(element('p', { role: 'status', class: 'c-loading' }, 'Loading consonant guide…'));
    try {
      const response = await fetch('./data/consonants.json');
      if (!response.ok) throw new Error('Consonant data unavailable');
      const json = await response.json();
      if (!Array.isArray(json.consonants) || !json.consonants.length) throw new Error('Empty consonant data');
      rows = json.consonants;
      mount();
    } catch {
      root.replaceChildren(element('div', { class: 'c-empty', role: 'alert' }, element('h2', {}, 'Consonant guide unavailable'), element('p', {}, 'Check your connection and try again. The vowel guide is still available in its tab.'), button('Try again', load)));
    }
  }
  load();
  return { stop: player.stop };
}
