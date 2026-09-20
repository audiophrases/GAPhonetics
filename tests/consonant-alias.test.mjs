import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterConsonants, initialConsonantState } from '../site/consonant-state.js';
const { consonants } = JSON.parse(await readFile(new URL('../site/data/consonants.json', import.meta.url), 'utf8'));
test('English r alias resolves only to the English approximant', () => {
  for (const query of ['r', '/r/', ' /R/ ', 'ɹ', '/ɹ/']) {
    const found = filterConsonants(consonants, { ...initialConsonantState(), query });
    assert.deepEqual(found.map(row => row.ipa), ['ɹ'], query);
  }
});
