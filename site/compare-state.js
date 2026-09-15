export function assignCompareVowel(state, key) {
  if (!state.compareMode || !key) return false;

  const target = state.compareTarget === 'a' ? 'a' : 'b';
  if (target === 'a') {
    if (key === state.compareB) return false;
    state.compareA = key;
  } else {
    if (key === state.compareA) return false;
    state.compareB = key;
  }
  return true;
}

export function selectDiagramVowel(state, key) {
  if (!state.compareMode || !key) return { changed: false, armed: false };

  // Clicking an already highlighted endpoint arms that side. The next
  // diagram click then replaces it, making both comparison vowels editable.
  if (key === state.compareA) {
    state.compareTarget = 'a';
    return { changed: false, armed: true };
  }
  if (key === state.compareB) {
    state.compareTarget = 'b';
    return { changed: false, armed: true };
  }

  return { changed: assignCompareVowel(state, key), armed: false };
}

export function armCompareSide(state, side) {
  state.compareTarget = side === 'a' ? 'a' : 'b';
}
