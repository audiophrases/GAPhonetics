import { MANNERS, initialConsonantState, reduceConsonants, filterConsonants, groupConsonants, wordParts, modeFromHash, modeForKey, pairFromHash } from './consonant-state.js';

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

  async function playSequence(items, rate = 1) {
    stop();
    const token = generation;
    const current = () => token === generation;
    for (let i = 0; i < items.length; i++) {
      if (!current()) return;
      const item = items[i];
      await new Promise(resolve => {
        let clip;
        const done = (kind) => {
          if (clip) {
            clip.onended = clip.onerror = null;
            clip.pause();
          }
          active = null;
          if (current()) onStatus({ kind, word: item.word });
          resolve();
        };
        try {
          clip = createAudio(item.url);
          active = clip;
          clip.preload = 'none';
          clip.playbackRate = rate;
          clip.preservesPitch = true;
          clip.onended = () => done('ended');
          clip.onerror = () => done('error');
          if (current()) onStatus({ kind: 'playing', word: item.word });
          clip.play().catch(() => done('error'));
        } catch {
          done('error');
        }
      });
      if (i < items.length - 1 && current()) {
        await new Promise(r => setTimeout(r, 380));
      }
    }
    if (current()) onStatus({ kind: 'idle' });
  }

  return { play, playSequence, stop };
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
  for (const child of children.flat()) {
    if (child == null || child === '') continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
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
  let list, detail, count, queryInput, mannerSelect, placeSelect, voiceSelect, playbackStatus, stopButton, compareBar;
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
    renderCompareBar();
    renderDetail();
    if (!state.compareMode) {
      focusDetail();
    }
  }
  function syncSelection() {
    list.querySelectorAll('[data-consonant]').forEach(node => {
      const k = node.dataset.consonant;
      const isSel = k === state.selected;
      const isComp = state.compareMode && k === state.compare;
      node.setAttribute('aria-pressed', String(isSel || isComp));
      node.classList.toggle('is-selected', isSel);
      node.classList.toggle('is-compare-a', state.compareMode && isSel);
      node.classList.toggle('is-compare-b', isComp);
    });
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
        element('div', { class: 'c-tiles' }, ...group.items.map(p => {
          const isSel = p.key === state.selected;
          const isComp = state.compareMode && p.key === state.compare;
          return button([
            element('span', { class: 'c-tile-top' },
              element('span', { class: 'c-ipa' }, `/${p.ipa}/`),
              button('▶', (e) => {
                e.stopPropagation();
                player.play(p.phonemeAudio || p.audio, `/${p.ipa}/`, state.rate);
              }, { class: 'c-tile-play', title: `Play /${p.ipa}/ sound`, 'aria-label': `Play /${p.ipa}/ sound` })
            ),
            element('div', { class: 'c-tile-bottom' },
              highlightedWord(p),
              element('span', { class: `c-voice ${p.voiced ? 'c-voice--voiced' : ''}` }, voiceLabel(p))
            )
          ], () => select(p.key), {
            class: `c-tile ${isSel ? 'is-selected' : ''} ${state.compareMode && isSel ? 'is-compare-a' : ''} ${isComp ? 'is-compare-b' : ''}`,
            'data-consonant': p.key,
            'aria-pressed': String(isSel || isComp),
            'aria-label': `Select /${p.ipa}/ as in ${p.example[0]}, ${voiceLabel(p).toLowerCase()} ${p.place} ${p.manner}`,
            'aria-controls': 'consonantDetail'
          });
        }))
      ));
    }
  }
  function hear(p) {
    return element('div', { class: 'c-hear-row' },
      button(`▶ Sound /${p.ipa}/`, () => player.play(p.phonemeAudio || p.audio, `/${p.ipa}/`, state.rate), { class: 'c-button c-hear c-hear--phoneme', 'data-hear': `/${p.ipa}/` }),
      button(`▶ Word (${p.example[0]})`, () => player.play(p.audio, p.example[0], state.rate), { class: 'c-button c-hear c-hear--word', 'data-hear': p.example[0] })
    );
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
      element('div', { class: 'c-detail-heading' }, element('h2', { id: 'consonantDetailTitle', tabindex: '-1' }, (state.compareMode && other) || other ? 'Sound contrast' : 'Your pronunciation guide'), button('Back to sounds ↑', () => {
        const tile = Array.from(list.querySelectorAll('[data-consonant]')).find(node => node.dataset.consonant === state.selected);
        (tile || queryInput).focus();
      }, { class: 'c-button c-button--quiet' })),
      element('p', { class: 'c-muted' }, 'Highlighted letters show the target sound. You can listen to the isolated phoneme or the whole example word.'),
      element('div', { class: 'c-listening-tools' }, label('Playback speed', rateSelect), stopButton = button('Stop audio', () => player.stop())),
      playbackStatus = element('p', { class: 'c-audio-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, 'Choose Sound or Word to listen.'),
      element('div', { class: 'c-compare-tools' },
        label('Compare with another sound', comparison),
        (counterpart && state.compare !== counterpart.key) ? button(`Compare ${voiceLabel(counterpart).toLowerCase()} /${counterpart.ipa}/`, () => {
          player.stop(); dispatch({ type: 'compare', key: counterpart.key }); renderDetail(); focusDetail();
        }, { class: 'c-button c-counterpart' }) : '',
        other ? button('⇄ Swap sounds', () => {
          player.stop(); dispatch({ type: 'swapCompare' }); syncSelection(); renderDetail(); renderCompareBar();
        }, { class: 'c-button c-button--quiet' }) : '',
        other ? button('▶ Play Sequence', () => {
          player.playSequence([
            { url: p.phonemeAudio || p.audio, word: `/${p.ipa}/` },
            { url: other.phonemeAudio || other.audio, word: `/${other.ipa}/` }
          ], state.rate);
        }, { class: 'c-button c-button--accent' }) : ''
      ),
      other ? element('p', { class: 'c-contrast-note' }, p.counterpart === other.key ? 'Same place and manner; notice the change in voicing. Feel vocal-fold vibration.' : 'Compare mouth position, airflow, and voicing below.') : (!counterpart ? element('p', { class: 'c-muted' }, 'No direct voicing counterpart in the core inventory. Choose any other sound to compare.') : ''),
      element('div', { class: 'c-guides' }, soundGuide(p), other ? soundGuide(other, true) : '')
    );
    stopButton.disabled = true;
  }
  const PRESET_PAIRS = [
    { a: 'p', b: 'b', label: '/p/ vs /b/ (pie/bye)' },
    { a: 't', b: 'd', label: '/t/ vs /d/ (tie/die)' },
    { a: 'k', b: 'g', label: '/k/ vs /g/ (came/game)' },
    { a: 's', b: 'z', label: '/s/ vs /z/ (seal/zeal)' },
    { a: 'θ', b: 'ð', label: '/θ/ vs /ð/ (think/this)' },
    { a: 'tʃ', b: 'dʒ', label: '/tʃ/ vs /dʒ/ (chin/gin)' },
    { a: 'f', b: 'v', label: '/f/ vs /v/ (fan/van)' },
    { a: 'ʃ', b: 'ʒ', label: '/ʃ/ vs /ʒ/ (ship/vision)' },
    { a: 'm', b: 'n', label: '/m/ vs /n/ (sum/sun)' },
    { a: 'w', b: 'v', label: '/w/ vs /v/ (wet/vet)' }
  ];

  function renderCompareBar() {
    if (!compareBar) return;
    const pA = rows.find(r => r.key === state.selected);
    const pB = rows.find(r => r.key === state.compare);
    const isTargetA = state.compareTarget === 'a';
    const isTargetB = state.compareTarget === 'b';

    const selA = element('select', {
      id: 'consonantCompareA',
      'aria-label': 'Primary consonant (Slot A)',
      onchange: (e) => {
        player.stop();
        dispatch({ type: 'arm', side: 'a' });
        dispatch({ type: 'select', key: e.target.value });
        syncSelection();
        renderCompareBar();
        renderDetail();
      }
    }, ...rows.map(r => element('option', { value: r.key, selected: r.key === state.selected ? '' : null }, `/${r.ipa}/ — ${r.example[0]}`)));

    const selB = element('select', {
      id: 'consonantCompareB',
      'aria-label': 'Contrast consonant (Slot B)',
      onchange: (e) => {
        player.stop();
        dispatch({ type: 'arm', side: 'b' });
        dispatch({ type: 'select', key: e.target.value });
        syncSelection();
        renderCompareBar();
        renderDetail();
      }
    }, ...rows.map(r => element('option', { value: r.key, selected: r.key === state.compare ? '' : null }, `/${r.ipa}/ — ${r.example[0]}`)));

    compareBar.replaceChildren(
      element('div', { class: 'c-compare-bar-inner' },
        element('div', { class: 'c-compare-header-row' },
          element('button', {
            type: 'button',
            class: `c-button c-compare-toggle ${state.compareMode ? 'is-active' : ''}`,
            'aria-pressed': String(state.compareMode),
            onclick: () => {
              player.stop();
              dispatch({ type: 'toggleCompare' });
              syncSelection();
              renderCompareBar();
              renderDetail();
            }
          }, state.compareMode ? '✓ Compare Mode Enabled' : '⚡ Enable Comparison Mode'),
          state.compareMode ? element('div', { class: 'c-compare-slots' },
            element('div', { class: `c-compare-slot ${isTargetA ? 'is-armed' : ''}` },
              button('', () => {
                dispatch({ type: 'arm', side: 'a' });
                renderCompareBar();
              }, { class: 'swatch swatch--sel swatch--btn', 'aria-label': 'Make chart clicks fill slot A', 'aria-pressed': String(isTargetA), title: 'Clicks fill slot A' }),
              selA
            ),
            button('⇄', () => {
              player.stop();
              dispatch({ type: 'swapCompare' });
              syncSelection();
              renderCompareBar();
              renderDetail();
            }, { class: 'c-button c-button--quiet c-swap-btn', title: 'Swap consonants', 'aria-label': 'Swap consonants' }),
            element('div', { class: `c-compare-slot ${isTargetB ? 'is-armed' : ''}` },
              button('', () => {
                dispatch({ type: 'arm', side: 'b' });
                renderCompareBar();
              }, { class: 'swatch swatch--compB swatch--btn', 'aria-label': 'Make chart clicks fill slot B', 'aria-pressed': String(isTargetB), title: 'Clicks fill slot B' }),
              selB
            ),
            button('▶ Play Sequence', () => {
              if (pA && pB) {
                player.playSequence([
                  { url: pA.phonemeAudio || pA.audio, word: `/${pA.ipa}/` },
                  { url: pB.phonemeAudio || pB.audio, word: `/${pB.ipa}/` }
                ], state.rate);
              }
            }, { class: 'c-button c-button--accent', title: 'Play phoneme A then phoneme B' })
          ) : null
        ),
        state.compareMode ? element('div', { class: 'c-compare-presets' },
          element('span', { class: 'c-compare-presets-label' }, 'Voicing & Minimal Pairs:'),
          ...PRESET_PAIRS.map(pair => button(pair.label, () => {
            player.stop();
            dispatch({ type: 'setComparePair', a: pair.a, b: pair.b });
            syncSelection();
            renderCompareBar();
            renderDetail();
          }, { class: 'c-preset-btn' }))
        ) : null
      )
    );
  }

  function filterControl(id, values, field) {
    return element('select', { id, 'aria-label': field, onchange: event => { player.stop(); dispatch({ type: 'filter', field, value: event.target.value }); renderList(); } }, ...values.map(([value, text]) => element('option', { value }, text)));
  }
  function mount() {
    queryInput = element('input', { id: 'consonantSearch', type: 'search', placeholder: 'Try /θ/, vision, teeth, or voiced nasal…', autocomplete: 'off', oninput: event => {
      player.stop(); dispatch({ type: 'filter', field: 'query', value: event.target.value }); renderList();
    } });
    mannerSelect = filterControl('consonantManner', [['all', 'All manners'], ...MANNERS.map(m => [m.key, `${m.label} — ${m.friendly}`])], 'manner');
    placeSelect = filterControl('consonantPlace', [['all', 'All places'], ...Array.from(new Set(rows.map(p => p.place))).map(place => [place, `${place} — ${rows.find(p => p.place === place).placeLabel}`])], 'place');
    voiceSelect = filterControl('consonantVoice', [['all', 'Both'], ['voiced', 'Voiced'], ['voiceless', 'Voiceless']], 'voice');
    root.replaceChildren(
      element('header', { class: 'c-top-header' },
        element('div', { class: 'c-title-area' },
          element('div', { class: 'c-eyebrow' }, '24 sounds · General American'),
          element('h1', { id: 'consonantTitle' }, 'Consonants'),
          element('p', { class: 'c-subtext' }, 'Direct ▶ plays phoneme sound. Click tile to inspect posture.')
        ),
        element('div', { class: 'c-header-actions' },
          element('div', { class: 'c-voice-pill' },
            element('strong', {}, 'Throat check:'),
            element('span', {}, 'Voiced sounds vibrate the throat; voiceless do not.')
          ),
          compareBar = element('div', { id: 'consonantCompareBar', class: 'c-compare-bar-wrap' })
        )
      ),
      element('section', { class: 'c-filters-bar', 'aria-label': 'Consonant search and filters' },
        element('div', { class: 'c-search-field' }, queryInput),
        mannerSelect,
        placeSelect,
        voiceSelect,
        count = element('span', { class: 'c-count-badge', role: 'status', 'aria-live': 'polite' }),
        button('Reset', resetFilters, { class: 'c-button c-button--quiet c-reset-btn' })
      ),
      element('div', { class: 'c-workspace' },
        element('section', { class: 'c-browser', 'aria-label': 'Consonants grouped by manner' },
          list = element('div', { id: 'consonantList' })
        ),
        detail = element('aside', { id: 'consonantDetail', class: 'c-detail', 'aria-labelledby': 'consonantDetailTitle' })
      ),
      element('p', { class: 'c-footnote' }, 'Core phonemes: /ɹ/ is the English r; /j/ is the y in yes. Play directly from cards or explore articulatory details.')
    );
    renderCompareBar();
    renderList();
    renderDetail();
  }
  async function load() {
    root.replaceChildren(element('p', { role: 'status', class: 'c-loading' }, 'Loading consonant guide…'));
    try {
      const response = await fetch('./data/consonants.json');
      if (!response.ok) throw new Error('Consonant data unavailable');
      const json = await response.json();
      if (!Array.isArray(json.consonants) || !json.consonants.length) throw new Error('Empty consonant data');
      rows = json.consonants;
      // A deep link (#consonants?a=ð&b=d) opens straight onto that contrast.
      const linked = modeFromHash(window.location.hash) === 'consonants' ? pairFromHash(window.location.hash) : null;
      if (linked) {
        if (linked.b) dispatch({ type: 'setComparePair', a: linked.a, b: linked.b });
        else dispatch({ type: 'select', key: linked.a });
      }
      mount();
    } catch {
      root.replaceChildren(element('div', { class: 'c-empty', role: 'alert' }, element('h2', {}, 'Consonant guide unavailable'), element('p', {}, 'Check your connection and try again. The vowel guide is still available in its tab.'), button('Try again', load)));
    }
  }
  load();
  return { stop: player.stop };
}
