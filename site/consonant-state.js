// Pure learning-state helpers. No DOM, audio resources, or mutations.
export const MANNERS = Object.freeze([
  { key: 'stop', label: 'Stops', friendly: 'Block & release', description: 'Briefly stop the air, then let it go.' },
  { key: 'fricative', label: 'Fricatives', friendly: 'Air through a gap', description: 'Keep the air moving through a narrow passage.' },
  { key: 'affricate', label: 'Affricates', friendly: 'Stop, then friction', description: 'Join a brief closure and a hiss into one sound.' },
  { key: 'nasal', label: 'Nasals', friendly: 'Air through the nose', description: 'Close the mouth passage and let the voice hum through the nose.' },
  { key: 'approximant', label: 'Approximants', friendly: 'Smooth airflow', description: 'Bring the articulators close without noisy friction; l lets air flow at the sides.' }
]);

export function initialConsonantState() {
  return { selected: 'p', compare: 'b', compareMode: true, compareTarget: 'b', query: '', manner: 'all', place: 'all', voice: 'all', rate: 1 };
}

export function reduceConsonants(state, action, rows) {
  const exists = key => rows.some(p => p.key === key);
  switch (action.type) {
    case 'select': {
      if (!exists(action.key)) return state;
      if (!state.compareMode) {
        return { ...state, selected: action.key, compare: state.compare === action.key ? null : state.compare };
      }
      const target = state.compareTarget === 'a' ? 'a' : 'b';
      if (action.key === state.selected) {
        return { ...state, compareTarget: 'a' };
      }
      if (action.key === state.compare) {
        return { ...state, compareTarget: 'b' };
      }
      if (target === 'a') {
        if (action.key === state.compare) return state;
        return { ...state, selected: action.key };
      } else {
        if (action.key === state.selected) return state;
        return { ...state, compare: action.key };
      }
    }
    case 'arm': return ['a', 'b'].includes(action.side) ? { ...state, compareTarget: action.side } : state;
    case 'toggleCompare': {
      const mode = action.value !== undefined ? Boolean(action.value) : !state.compareMode;
      let compare = state.compare;
      if (mode && !compare) {
        const cur = rows.find(p => p.key === state.selected);
        compare = cur?.counterpart || rows.find(p => p.key !== state.selected)?.key || null;
      }
      return { ...state, compareMode: mode, compare };
    }
    case 'swapCompare': {
      if (!state.compare) return state;
      return { ...state, selected: state.compare, compare: state.selected };
    }
    case 'setComparePair': {
      if (exists(action.a) && exists(action.b) && action.a !== action.b) {
        return { ...state, compareMode: true, selected: action.a, compare: action.b };
      }
      return state;
    }
    case 'compare': return action.key === null || (exists(action.key) && action.key !== state.selected) ? { ...state, compare: action.key } : state;
    case 'filter': return ['query','manner','place','voice'].includes(action.field) ? { ...state, [action.field]: action.value } : state;
    case 'rate': return [0.75,1].includes(action.value) ? { ...state, rate: action.value } : state;
    case 'reset': return { ...state, query: '', manner: 'all', place: 'all', voice: 'all' };
    default: return state;
  }
}

const normalize = value => String(value || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
export function filterConsonants(rows, state) {
  const normalizedQuery = normalize(state.query);
  const query = normalizedQuery === 'r' ? 'ɹ' : normalizedQuery;
  // An exact IPA query is a symbol lookup, not a substring in the prose.
  const exactIPA = rows.some(p => p.ipa === query || p.key === query);
  const tokens = query.split(/\s+/).filter(Boolean);
  return rows.filter(p => {
    if (state.manner !== 'all' && p.manner !== state.manner) return false;
    if (state.place !== 'all' && p.place !== state.place) return false;
    if (state.voice !== 'all' && p.voiced !== (state.voice === 'voiced')) return false;
    if (exactIPA) return p.ipa === query || p.key === query;
    const manner = MANNERS.find(m => m.key === p.manner);
    const text = normalize([p.ipa, ...p.example, p.manner, manner?.label, manner?.friendly, p.place, p.placeLabel, p.voiced ? 'voiced' : 'voiceless', p.mouth, p.cue].join(' '));
    return tokens.every(token => {
      if (token === 'voiced') return p.voiced;
      if (token === 'voiceless') return !p.voiced;
      if (rows.some(row => row.place === token)) return p.place === token;
      if (MANNERS.some(m => m.key === token)) return p.manner === token;
      return text.includes(token);
    });
  });
}

export function groupConsonants(rows) {
  return MANNERS.map(m => ({ ...m, items: rows.filter(p => p.manner === m.key) })).filter(m => m.items.length);
}

export function wordParts(p) {
  const word = p.example[0];
  const [start, end] = p.highlight;
  return [word.slice(0, start), word.slice(start, end), word.slice(end)];
}

// The hash carries the mode and, optionally, a sound or a pair to open in compare mode:
//   #vowels            #consonants
//   #vowels?a=æ        #consonants?a=ð&b=d
// so another page (e.g. a pronunciation coach) can deep-link to "this sound vs that one".
export const modeFromHash = hash => (hash || '').replace(/^#/, '').split('?')[0] === 'consonants' ? 'consonants' : 'vowels';
export function pairFromHash(hash) {
  const query = (hash || '').split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const a = params.get('a');
  if (!a) return null;
  return { a, b: params.get('b') || null };
}
export function modeForKey(mode, key) {
  if (key === 'Home') return 'vowels';
  if (key === 'End') return 'consonants';
  if (key === 'ArrowLeft' || key === 'ArrowRight') return mode === 'vowels' ? 'consonants' : 'vowels';
  return null;
}
export function isVowelShortcut(mode, tag, editable = false, handled = false) {
  return mode === 'vowels' && !handled && !editable && !['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(tag);
}
