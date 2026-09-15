import assert from 'node:assert/strict';
import test from 'node:test';
import { assignCompareVowel, selectDiagramVowel } from '../site/compare-state.js';

test('diagram selection can replace the primary vowel when A is armed', () => {
  const state = { compareMode: true, compareA: 'i', compareB: 'ɪ', compareTarget: 'a' };

  assignCompareVowel(state, 'ɛ');

  assert.equal(state.compareA, 'ɛ');
  assert.equal(state.compareB, 'ɪ');
});

test('diagram selection replaces the contrast vowel by default', () => {
  const state = { compareMode: true, compareA: 'i', compareB: 'ɪ', compareTarget: 'b' };

  assignCompareVowel(state, 'ɛ');

  assert.equal(state.compareA, 'i');
  assert.equal(state.compareB, 'ɛ');
});

test('selecting the same vowel does not create a self-comparison', () => {
  const state = { compareMode: true, compareA: 'i', compareB: 'ɪ', compareTarget: 'a' };

  assignCompareVowel(state, 'ɪ');

  assert.equal(state.compareA, 'i');
  assert.equal(state.compareB, 'ɪ');
});
