import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const inventory = { p:'put', b:'be', t:'top', d:'day', k:'cot', g:'go', f:'fire', v:'voice', θ:'think', ð:'the', s:'saw', z:'zoo', ʃ:'shoe', ʒ:'vision', h:'hot', tʃ:'chair', dʒ:'judge', m:'man', n:'no', ŋ:'sing', l:'look', ɹ:'red', j:'yes', w:'work' };
const data = async () => JSON.parse(await readFile(new URL('../site/data/consonants.json', import.meta.url), 'utf8')).consonants;
const helpers = () => import('../site/consonant-state.js');

test('core inventory contains exactly the 24 GA consonants and fixed word examples', async () => {
  const rows = await data();
  assert.equal(rows.length, 24);
  assert.equal(new Set(rows.map(p => p.key)).size, 24);
  assert.deepEqual(Object.fromEntries(rows.map(p => [p.key, p.example[0]])), inventory);
  for (const p of rows) {
    assert.equal(p.ipa, p.key);
    assert.equal(typeof p.voiced, 'boolean');
    for (const field of ['manner','place','placeLabel','cue','mistake','mouth']) assert.ok(p[field]?.length > 3, `${p.key}: ${field}`);
    assert.ok(p.steps.length >= 2);
    assert.equal(p.audio, `audio/words/${p.example[0]}.mp3`);
    assert.equal(p.highlight.length, 2);
    assert.ok(p.highlight[0] >= 0 && p.highlight[1] > p.highlight[0] && p.highlight[1] <= p.example[0].length);
  }
});

test('voicing counterparts are reciprocal and share place and manner', async () => {
  const rows = await data();
  assert.equal(rows.filter(p => p.counterpart).length, 16);
  for (const p of rows.filter(p => p.counterpart)) {
    const other = rows.find(q => q.key === p.counterpart);
    assert.equal(other.counterpart, p.key);
    assert.equal(other.manner, p.manner);
    assert.equal(other.place, p.place);
    assert.notEqual(other.voiced, p.voiced);
  }
});

test('highlight selects the exact spelling, including medial vision and final sing', async () => {
  const { wordParts } = await helpers();
  const rows = await data();
  const targets = { ...Object.fromEntries(Object.keys(inventory).map(k => [k, inventory[k][0]])), θ:'th', ð:'th', ʃ:'sh', ʒ:'s', tʃ:'ch', dʒ:'j', ŋ:'ng' };
  for (const p of rows) {
    const parts = wordParts(p);
    assert.equal(parts.join(''), p.example[0]);
    assert.equal(parts[1], targets[p.key], p.key);
  }
});

test('pedagogy distinguishes English r, y, ng and medial zh', async () => {
  const by = Object.fromEntries((await data()).map(p => [p.key,p]));
  assert.equal(by.ɹ.manner, 'approximant');
  assert.match(by.ɹ.mistake, /trill/i);
  assert.match(by.j.mistake, /judge/);
  assert.match(by.ŋ.mistake, /extra.*g/i);
  assert.match(by.ʒ.cue, /middle|medial/i);
});

test('search finds IPA (with slashes), word, friendly label and articulatory terms', async () => {
  const { filterConsonants, initialConsonantState } = await helpers();
  const rows = await data();
  const query = q => filterConsonants(rows, { ...initialConsonantState(), query:q }).map(p => p.key);
  assert.deepEqual(query(' /θ/ '), ['θ']);
  assert.deepEqual(query('VISION'), ['ʒ']);
  assert.ok(query('teeth').includes('f'));
  assert.deepEqual(query('voiceless dental'), ['θ']);
  assert.deepEqual(query('bilabial nasal'), ['m']);
  assert.deepEqual(query('zzzz'), []);
});

test('manner, place, voicing and search filters combine without mutating data', async () => {
  const { filterConsonants, initialConsonantState, groupConsonants } = await helpers();
  const rows = await data();
  const snapshot = JSON.stringify(rows);
  const state = { ...initialConsonantState(), manner:'fricative', voice:'voiced', place:'dental', query:'th' };
  assert.deepEqual(filterConsonants(rows, state).map(p => p.key), ['ð']);
  assert.deepEqual(filterConsonants(rows, { ...state, query:'zoo' }), []);
  assert.deepEqual(groupConsonants(rows).map(g => [g.key,g.items.length]), [['stop',6],['fricative',9],['affricate',2],['nasal',3],['approximant',4]]);
  assert.equal(JSON.stringify(rows), snapshot);
});

test('selection and reset keep independent learning state, reject invalid/self contrasts', async () => {
  const { initialConsonantState, reduceConsonants } = await helpers();
  const rows = await data();
  const initial = initialConsonantState();
  let state = reduceConsonants(initial, { type:'arm', side:'a' }, rows);
  state = reduceConsonants(state, { type:'select', key:'θ' }, rows);
  state = reduceConsonants(state, { type:'compare', key:'ð' }, rows);
  state = reduceConsonants(state, { type:'filter', field:'query', value:'zoo' }, rows);
  state = reduceConsonants(state, { type:'rate', value:0.75 }, rows);
  const reset = reduceConsonants(state, { type:'reset' }, rows);
  assert.deepEqual([reset.selected, reset.compare, reset.rate, reset.query, reset.voice], ['θ','ð',0.75,'','all']);
  assert.equal(initial.selected, 'p');
  assert.equal(reduceConsonants(reset, { type:'select', key:'invalid' }, rows), reset);
  assert.equal(reduceConsonants(reset, { type:'compare', key:'θ' }, rows), reset);
  assert.equal(reduceConsonants(reset, { type:'rate', value:2 }, rows), reset);
});

test('consonant comparison state machine supports arming, swapping, and minimal pair presets', async () => {
  const { initialConsonantState, reduceConsonants } = await helpers();
  const rows = await data();
  let s = initialConsonantState();
  assert.equal(s.compareMode, true);
  assert.equal(s.selected, 'p');
  assert.equal(s.compare, 'b');

  // Toggle off and on
  s = reduceConsonants(s, { type: 'toggleCompare' }, rows);
  assert.equal(s.compareMode, false);
  s = reduceConsonants(s, { type: 'toggleCompare' }, rows);
  assert.equal(s.compareMode, true);

  // Arm slot a and select /t/
  s = reduceConsonants(s, { type: 'arm', side: 'a' }, rows);
  s = reduceConsonants(s, { type: 'select', key: 't' }, rows);
  assert.equal(s.selected, 't');
  assert.equal(s.compare, 'b');

  // Swap comparison
  s = reduceConsonants(s, { type: 'swapCompare' }, rows);
  assert.equal(s.selected, 'b');
  assert.equal(s.compare, 't');

  // Preset pair
  s = reduceConsonants(s, { type: 'setComparePair', a: 's', b: 'z' }, rows);
  assert.equal(s.selected, 's');
  assert.equal(s.compare, 'z');
});

test('mode deep links and tab arrow keys have deterministic behavior', async () => {
  const { modeFromHash, modeForKey, isVowelShortcut } = await helpers();
  assert.equal(modeFromHash('#consonants'), 'consonants');
  assert.equal(modeFromHash('#vowels'), 'vowels');
  assert.equal(modeFromHash('#unknown'), 'vowels');
  assert.equal(modeForKey('vowels','ArrowRight'), 'consonants');
  assert.equal(modeForKey('consonants','ArrowLeft'), 'vowels');
  assert.equal(modeForKey('vowels','End'), 'consonants');
  assert.equal(modeForKey('consonants','Home'), 'vowels');
  assert.equal(modeForKey('consonants','Tab'), null);
  assert.equal(isVowelShortcut('consonants', 'DIV', false, false), false);
  assert.equal(isVowelShortcut('vowels', 'BUTTON', false, false), false);
  assert.equal(isVowelShortcut('vowels', 'TEXTAREA', false, false), false);
  assert.equal(isVowelShortcut('vowels', 'DIV', true, false), false);
  assert.equal(isVowelShortcut('vowels', 'DIV', false, true), false);
  assert.equal(isVowelShortcut('vowels', 'BODY', false, false), true);
});

test('tabs hide only their panels, restore focus on hash navigation and retain mounted content', async () => {
  const { initModeTabs } = await import('../site/consonants.js');
  const nodes = Object.fromEntries(['vowelsTab','consonantsTab','vowelsPanel','consonantsPanel','vowelControls'].map(id => [id, {
    id, hidden:false, attrs:{}, listeners:{}, children:[],
    setAttribute(k,v) { this.attrs[k]=v; },
    addEventListener(k,fn) { this.listeners[k]=fn; },
    contains(node) { return this === node || this.children.includes(node); },
    focus() { doc.activeElement=this; }
  }]));
  const inside = {}; nodes.vowelsPanel.children.push(inside);
  const doc = { body:{ dataset:{} }, activeElement:inside, getElementById:id => nodes[id] };
  const win = { location:{ hash:'#consonants' }, listeners:{}, addEventListener(k,fn){ this.listeners[k]=fn; }, history:{ pushState(_a,_b,hash){ win.location.hash=hash; } } };
  const changes = [];
  initModeTabs({ document:doc, window:win, onChange: mode => changes.push(mode) });
  assert.equal(nodes.vowelsPanel.hidden, true);
  assert.equal(nodes.vowelControls.hidden, true);
  assert.equal(nodes.consonantsPanel.hidden, false);
  assert.equal(nodes.consonantsTab.attrs['aria-selected'], 'true');
  assert.equal(doc.activeElement, nodes.consonantsTab);
  let prevented=false;
  nodes.consonantsTab.listeners.keydown({ key:'ArrowLeft', preventDefault(){ prevented=true; } });
  assert.equal(prevented, true);
  assert.equal(win.location.hash, '#vowels');
  assert.equal(nodes.vowelsPanel.hidden, false);
  assert.equal(nodes.vowelControls.hidden, false);
  assert.equal(doc.activeElement, nodes.vowelsTab);
  assert.equal(nodes.vowelsPanel.children[0], inside);
  win.location.hash='#consonants'; win.listeners.hashchange();
  assert.equal(doc.body.dataset.mode, 'consonants');
  assert.deepEqual(changes, ['consonants','vowels','consonants']);
});

// Audio is a browser resource; this controllable media boundary exercises the
// real controller's async lifecycle without requiring a sound device in Node.
function mediaHarness() {
  const clips = [], events = [];
  const createAudio = url => {
    let resolve, reject;
    const promise = new Promise((yes,no) => { resolve=yes; reject=no; });
    const clip = { url, currentTime:0, paused:false, pause(){ this.paused=true; }, play(){ return promise; }, resolve, reject, onended:null, onerror:null };
    clips.push(clip);
    return clip;
  };
  return { clips, events, createAudio, onStatus: status => events.push(status) };
}

test('word player plays one whole-word URL at selected speed and reports completion', async () => {
  const { createWordPlayer } = await import('../site/consonants.js');
  const h = mediaHarness(), player = createWordPlayer(h);
  const pending = player.play('audio/words/put.mp3', 'put', 0.75);
  assert.equal(h.clips[0].url, 'audio/words/put.mp3');
  assert.equal(h.clips[0].playbackRate, 0.75);
  h.clips[0].resolve(); await pending;
  assert.equal(h.events.at(-1).kind, 'playing');
  h.clips[0].onended();
  assert.equal(h.events.at(-1).kind, 'ended');
});

test('replacement cancels a pending clip; stale resolution cannot revive it', async () => {
  const { createWordPlayer } = await import('../site/consonants.js');
  const h = mediaHarness(), player = createWordPlayer(h);
  const first = player.play('a.mp3','a',1);
  const second = player.play('b.mp3','b',1);
  assert.equal(h.clips[0].paused, true);
  h.clips[1].resolve(); await second;
  h.clips[0].resolve(); await first;
  assert.equal(h.clips[0].paused, true);
  assert.equal(h.events.at(-1).word, 'b');
  assert.equal(h.events.at(-1).kind, 'playing');
});

test('navigation stop invalidates late rejection and detached ended callbacks', async () => {
  const { createWordPlayer } = await import('../site/consonants.js');
  const h = mediaHarness(), player = createWordPlayer(h);
  const pending = player.play('a.mp3','a',1);
  const ended = h.clips[0].onended;
  player.stop();
  const count = h.events.length;
  h.clips[0].reject(new Error('late network error')); await pending;
  ended();
  assert.equal(h.events.length, count);
  assert.equal(h.clips[0].paused, true);
  assert.equal(h.events.at(-1).kind, 'idle');
});

test('play rejection and media load error give recoverable unavailable status', async () => {
  const { createWordPlayer } = await import('../site/consonants.js');
  const h = mediaHarness(), player = createWordPlayer(h);
  const pending = player.play('missing.mp3','missing',1);
  h.clips[0].reject(new Error('missing')); await pending;
  assert.equal(h.events.at(-1).kind, 'error');
  const retry = player.play('ok.mp3','ok',1);
  h.clips[1].onerror(); h.clips[1].resolve(); await retry;
  assert.equal(h.events.at(-1).kind, 'error');
});


test('hash routing: mode and optional deep-linked sound pair', async () => {
  const { modeFromHash, pairFromHash } = await helpers();
  assert.equal(modeFromHash(''), 'vowels');
  assert.equal(modeFromHash('#consonants'), 'consonants');
  assert.equal(modeFromHash('#consonants?a=ð&b=d'), 'consonants');
  assert.equal(modeFromHash('#vowels?a=æ'), 'vowels');
  assert.equal(pairFromHash('#vowels'), null);
  assert.deepEqual(pairFromHash('#consonants?a=%C3%B0&b=d'), { a: 'ð', b: 'd' });
  assert.deepEqual(pairFromHash('#vowels?a=æ'), { a: 'æ', b: null });
  assert.equal(pairFromHash('#vowels?b=æ'), null);
});

test('setComparePair from a deep link ignores unknown or identical sounds', async () => {
  const { initialConsonantState, reduceConsonants } = await helpers();
  const rows = await data();
  const linked = reduceConsonants(initialConsonantState(), { type: 'setComparePair', a: 'ð', b: 'd' }, rows);
  assert.equal(linked.selected, 'ð');
  assert.equal(linked.compare, 'd');
  const same = reduceConsonants(initialConsonantState(), { type: 'setComparePair', a: 'ð', b: 'ð' }, rows);
  assert.equal(same.selected, 'p');
  const unknown = reduceConsonants(initialConsonantState(), { type: 'setComparePair', a: 'ð', b: 'q' }, rows);
  assert.equal(unknown.selected, 'p');
});
