import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const { phonemes } = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'phonemes.json'), 'utf8'));

// Mirrors slugWord() in site/app.js and tools/generate-audio.mjs.
const slugWord = (w) => w.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

test('every phoneme has at least one example word', () => {
  for (const p of phonemes) {
    assert.ok((p.example || []).length > 0, `/${p.ipa}/ (${p.key}) has no example words`);
  }
});

test('every phoneme has a recording', () => {
  for (const p of phonemes) {
    const file = path.join(siteDir, 'audio', 'phonemes', `${encodeURIComponent(p.key)}.mp3`);
    assert.ok(fs.existsSync(file), `missing ${path.relative(siteDir, file)} for /${p.ipa}/`);
  }
});

test('every example word has a recording', () => {
  for (const p of phonemes) {
    for (const w of p.example || []) {
      const file = path.join(siteDir, 'audio', 'words', `${slugWord(w)}.mp3`);
      assert.ok(fs.existsSync(file), `missing ${path.relative(siteDir, file)} for "${w}" under /${p.ipa}/`);
    }
  }
});

test('example words cited in an articulatory cue are listed as examples', () => {
  // Cues like "... (law, saw, caught)" should agree with the example list.
  for (const p of phonemes) {
    const cue = p.articulatory?.cue || '';
    const m = cue.match(/\(([a-z' ,]+)\)\.?$/i);
    if (!m) continue;
    const cited = m[1].split(',').map((w) => w.trim()).filter(Boolean);
    const listed = new Set((p.example || []).map((w) => w.toLowerCase()));
    // Cues may cite extra illustrative words, but must overlap the listed examples.
    const overlap = cited.filter((w) => listed.has(w.toLowerCase()));
    assert.ok(overlap.length > 0, `/${p.ipa}/ cue cites [${cited.join(', ')}] but examples are [${[...listed].join(', ')}]`);
  }
});
