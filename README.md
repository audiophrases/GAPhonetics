# General American Phonetics (GAPhonetics)

A dependency-free interactive reference for General American vowels and 24 core consonants.

## Run locally

From the repository root:

```sh
python -m http.server 5173
```

Open http://localhost:5173/site/ (vowels) or http://localhost:5173/site/#consonants.
Use HTTP, not `file://`, so the browser can load JSON and JavaScript modules.

## Explore consonants

- Switch between **Vowels** and **Consonants** without losing either mode's selection, filters, or comparison. Switching stops playback. State lasts for the current page session, not across reloads.
- Browse five manner groups: stops, fricatives, affricates, nasals, and approximants (including lateral /l/).
- Search IPA, example words, or plain-language placement cues; combine manner, place, and voicing filters. `/r/` is accepted as an alias for English /ɹ/.
- Choose a card for mouth position, step-by-step practice, what to feel, and a mistake to avoid. Highlighted letters identify the target sound in the example word.
- Compare any two consonants, or use the direct voicing-counterpart shortcut. These are sound contrasts in whole words, **not necessarily minimal pairs**.
- **Hear** plays the whole example word at normal or 0.75× speed. Stop cancels playback; a failed clip has a retry instruction. There are no invented isolated-consonant clips or TTS fallbacks in this mode.
- Keyboard: Tab reaches controls, Left/Right and Home/End switch the focused mode tab, Enter/Space selects cards. Back to sounds returns focus to the selected card (or search if filtered out).

English /ɹ/ is the r in *red*, /j/ is the y in *yes*, /ŋ/ is the final sound of *sing*, and /ʒ/ is medial in *vision*. Flaps and glottal stops are pronunciation variants, not extra entries in the core inventory.

## Project structure

- `site/index.html` — persistent accessible mode tabs and panel mounts
- `site/app.js`, `site/styles.css` — original vowel charts, reference table, anatomy and comparison
- `site/consonants.js`, `site/consonants.css` — consonant UI, tab controller, cancellable word player
- `site/consonant-state.js` — pure filtering, grouping, selection and mode helpers
- `site/data/phonemes.json` — original vowel inventory and chart placements
- `site/data/consonants.json` — 24 consonants, guides, contrasts and word-audio paths
- `site/data/consonant-audio-sources.json` — attribution and provenance for ten newly added human recordings
- `site/audio/phonemes/`, `site/audio/words/` — existing vowel/word library plus added consonant example words

## Audio and attribution

The ten new recordings (*go, voice, think, zoo, vision, chair, judge, sing, red, yes*) are human US-English word recordings from Wikimedia Commons. Consult [the source manifest](site/data/consonant-audio-sources.json) for each creator, original file page, license link, dialect evidence/caveats, processing details and hashes. These adaptations retain **CC BY-SA 3.0** licensing; attribution is also embedded in MP3 tags. Keep the manifest and attribution when redistributing them. The remaining consonant examples reuse existing word files; this manifest does not claim provenance for the older library.

The new clips retain the entire spoken word, without cropping a consonant out of context. They were converted to mono and gain-normalized/re-encoded, not synthesized or phonetic-content edited. Slowed playback is a browser playback-rate setting.

Legacy vowel audio paths remain `site/audio/phonemes/<key>.mp3`; word paths remain `site/audio/words/<slug>.mp3`. The existing `tools/generate-audio.mjs` (Piper via sherpa-onnx) and `tools/generate-audio-sapi.ps1` are legacy generation utilities, **not sources for the human consonant additions**. Do not replace attributed human files with generated speech.

## Tests

```sh
node --test "tests/*.test.mjs"
```

Covers vowel comparison and audio-file presence, consonant inventory/pedagogy/highlights, combined filtering, state retention, tab keyboard/focus behavior, cancellable word playback and error handling, plus HTML/app integration guards. See [DEV_NOTES.md](DEV_NOTES.md) for browser checks and architecture.

## GitHub Pages

The existing GitHub Actions workflow deploys `./site` on pushes to `main`:
https://audiophrases.github.io/GAPhonetics/
