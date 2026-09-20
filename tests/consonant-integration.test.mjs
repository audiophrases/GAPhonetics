import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isVowelShortcut } from '../site/consonant-state.js';

const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../site/app.js', import.meta.url), 'utf8');

test('document mounts accessible mode tabs and both persistent panels', () => {
  for (const id of ['vowelsTab', 'consonantsTab', 'vowelsPanel', 'consonantsPanel', 'vowelControls', 'consonantsRoot']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-controls="consonantsPanel"/);
  assert.match(html, /aria-labelledby="consonantsTab"/);
  assert.match(html, /href="\.\/consonants\.css"/);
  assert.ok(html.indexOf('id="vowelsPanel"') < html.indexOf('class="filterBar"'));
  assert.ok(html.indexOf('id="consonantsPanel"') > html.indexOf('id="refTable"'));
});

test('application initializes consonants and guards legacy vowel shortcuts', () => {
  assert.match(app, /import \{ initConsonants \} from '\.\/consonants\.js'/);
  assert.match(app, /initConsonants\(\{ onModeChange:/);
  assert.match(app, /if \(!isVowelShortcut\(/);
  assert.match(app, /e\.defaultPrevented/);
  for (const tag of ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']) assert.equal(isVowelShortcut('vowels', tag), false);
  assert.equal(isVowelShortcut('consonants', 'BODY'), false);
  assert.equal(isVowelShortcut('vowels', 'DIV', true), false);
  assert.equal(isVowelShortcut('vowels', 'BODY', false, true), false);
  assert.equal(isVowelShortcut('vowels', 'BODY'), true);
});

test('mode changes invalidate pending vowel audio and sequences', () => {
  assert.match(app, /function stopVowelAudio\(\)/);
  assert.match(app, /vowelAudioGeneration\+\+/);
  assert.match(app, /await waitForReady\(clip\);\s*if \(generation !== vowelAudioGeneration\) return;/);
  assert.match(app, /setTimeout\(r, 450\)\);\s*if \(generation !== vowelAudioGeneration\) return;/);
  assert.match(app, /setTimeout\(r, 320\)\);\s*if \(generation !== vowelAudioGeneration\) return;/);
});
