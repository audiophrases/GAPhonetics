import assert from 'node:assert/strict';
import test from 'node:test';
import { armCompareSide, assignCompareVowel, selectDiagramVowel } from '../site/compare-state.js';

const fresh = (target = 'b') => ({ compareMode: true, compareA: 'i', compareB: 'ɪ', compareTarget: target });

test('diagram selection can replace the primary vowel when A is armed', () => {
  const state = fresh('a');

  assignCompareVowel(state, 'ɛ');

  assert.equal(state.compareA, 'ɛ');
  assert.equal(state.compareB, 'ɪ');
});

test('diagram selection replaces the contrast vowel by default', () => {
  const state = fresh('b');

  assignCompareVowel(state, 'ɛ');

  assert.equal(state.compareA, 'i');
  assert.equal(state.compareB, 'ɛ');
});

test('selecting the same vowel does not create a self-comparison', () => {
  const state = fresh('a');

  assignCompareVowel(state, 'ɪ');

  assert.equal(state.compareA, 'i');
  assert.equal(state.compareB, 'ɪ');
});

test('clicking the primary vowel arms slot A so the next click changes A', () => {
  const state = fresh('b');

  assert.deepEqual(selectDiagramVowel(state, 'i'), { changed: false, armed: true });
  assert.equal(state.compareTarget, 'a');
  assert.equal(state.compareA, 'i', 'arming does not alter the pair');

  assert.deepEqual(selectDiagramVowel(state, 'æ'), { changed: true, armed: false });
  assert.equal(state.compareA, 'æ');
  assert.equal(state.compareB, 'ɪ');
  assert.equal(state.compareTarget, 'a', 'slot A stays armed for further clicks');
});

test('clicking the contrast vowel re-arms slot B', () => {
  const state = fresh('a');

  selectDiagramVowel(state, 'ɪ');
  assert.equal(state.compareTarget, 'b');

  selectDiagramVowel(state, 'u');
  assert.deepEqual([state.compareA, state.compareB], ['i', 'u']);
});

test('diagram selection is inert outside compare mode', () => {
  const state = { ...fresh('a'), compareMode: false };

  assert.deepEqual(selectDiagramVowel(state, 'u'), { changed: false, armed: false });
  assert.deepEqual([state.compareA, state.compareB, state.compareTarget], ['i', 'ɪ', 'a']);
});

test('armCompareSide only accepts a or b', () => {
  const state = fresh('b');

  armCompareSide(state, 'a');
  assert.equal(state.compareTarget, 'a');

  armCompareSide(state, 'nonsense');
  assert.equal(state.compareTarget, 'b');
});
