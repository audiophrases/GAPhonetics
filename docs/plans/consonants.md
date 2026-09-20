# Consonant Explorer Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a complete, intuitive 24-consonant General American learning workspace without regressing the existing vowel explorer.

**Architecture:** Keep vowels in the existing implementation; add a separate consonant data file, pure state helpers, and renderer. Accessible Vowels/Consonants tabs switch workspaces and preserve state. Human example-word audio is shared with the existing word directory; label playback as words, never misrepresent a whole word as an isolated consonant.

**Tech Stack:** Static HTML/CSS, native ES modules, Node test runner, human Wikimedia audio (MP3 with attribution tags).

## Task 1 — Data and behavior, RED then GREEN

Create `site/data/consonants.json`, `site/consonant-state.js`, `tests/consonants.test.mjs`.

Inventory contract (key → example): p→put, b→be, t→top, d→day, k→cot, g→go, f→fire, v→voice, θ→think, ð→the, s→saw, z→zoo, ʃ→shoe, ʒ→vision, h→hot, tʃ→chair, dʒ→judge, m→man, n→no, ŋ→sing, l→look, ɹ→red, j→yes, w→work. Each has a unique key, IPA, manner, place, voicing, exact target-letter highlighting, articulatory cue, mistake-to-avoid, and optional reciprocal voicing partner. Describe /ɹ/ as American approximant, not trill; /j/ is yes, not judge; /ŋ/ in sing has no appended /g/; /ʒ/ is medial in vision. No flap or glottal-stop allophones promoted as independent core phonemes.

Write and run failing tests before data/helpers: assert complete inventory, valid human-readable pedagogy fields, reciprocal counterpart relationships, combined case-insensitive search/filter, empty search, /r/ alias to /ɹ/, and sane selection behavior when filters hide the selected sound. `node --test tests/consonants.test.mjs` must fail for missing behavior, then pass after minimal implementation. Preserve existing tests.

## Task 2 — Responsive consonant workspace, RED then GREEN

Create `site/consonants.js`, `site/consonants.css`; modify `site/index.html` and only narrow integration points in `site/app.js`. Add accessible workspace tabs and deep links. Keep vowel controls only in the vowel workspace. Guard existing global vowel keyboard handlers when consonants is active and ignore editable/button controls. New UI: manner-grouped sound tiles with friendly labels (stops, friction, stop + friction, nose sounds, liquids, glides), visible voiced/voiceless labels, place/voicing filters and IPA/word search, clear no-results state, large detail card, how-to guidance, voiced/unvoiced partner compare, 0.75×/1× word listening, helpful /r/, /j/, /ŋ/ notes. Preserve state between switches and stop pending playback on navigation/new actions. Avoid auto-playing every selection; explicit hear-word buttons make playback predictable. Consonant comparisons are sound contrasts, not misleadingly labeled minimal pairs. Honor reduced motion, keyboard operation, visible focus and ≥44px touch targets. Mobile must avoid document horizontal overflow.

Behavior tests precede new helper/playback code. Verify browser at desktop and 390px widths, then run all tests. No dependencies unless needed for tests; any test-only dependency must be explicit and minimal.

## Task 3 — Human audio (independent asset worker)

Add only ten missing example MP3s: go, voice, think, zoo, vision, chair, judge, sing, red, yes. Existing human MP3s are reused unchanged. Use `pronunciation-audio-sourcing`; query canonical Commons/Wiktionary API metadata, require explicit US/GA and reusable licensing, preserve content and pitch, normalize conservatively. Embed source, creator, license URL, dialect, modifications in ID3; add a source manifest under `site/data/consonant-audio-sources.json`. No synthetic fallbacks or unlicensed commercial recordings. Stage and verify all assets; if a source is blocked, try official derivatives and respect Retry-After. Never fabricate assets.

## Task 4 — Integration and review

Update README and DEV_NOTES with use, architecture, data contracts, source/licensing approach, and verification commands. Keep prior vowel records and audio unchanged. Run `node --test "tests/*.test.mjs"`, then serve `site/`, fetch/decode all vowel and consonant runtime URLs and click each consonant in the real browser. Verify all 24 keys in a saved JSON checklist, responsive layouts, tabs/deep links, filters/no-results, voiced/unvoiced pairs, and playback controls. Spec reviewer first; fix gaps; quality reviewer second; fix issues and rerun tests. Do not commit or push without a new explicit request.
