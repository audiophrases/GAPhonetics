# Development notes

## Architecture

Static HTML, CSS and native JavaScript modules; no build step or new dependencies. Serve the repository with `python -m http.server 5173`, then visit `http://localhost:5173/site/`.

`index.html` owns two persistent tabpanels, `vowelsPanel` and `consonantsPanel`, labelled by `vowelsTab` and `consonantsTab`. The existing vowel search/compare/label controls live in `vowelControls`; the vowel filter bar, comparison toolbar and layout are all within the vowel panel. CSS enforces `[hidden]` over legacy flex/grid display declarations.

`app.js` initializes `initConsonants` independently before fetching vowel data. `consonants.js` calls `initModeTabs`, mounts its own controls inside `consonantsRoot`, and fetches `data/consonants.json`. A failed consonant fetch has an explicit Retry action and does not remove the vowel panel. Tabs use roving tabindex, `aria-selected`, native buttons, Left/Right/Home/End navigation, and focus restoration when history hides the focused panel. `#consonants` deep-links to the new mode; the default and `#vowels` show vowels. Panels are hidden, not destroyed, so learning state survives mode switching (not page reloads).

`consonant-state.js` contains pure reducers, filters, grouping and mode helpers. `consonants.js` owns rendering, live status messages, focus management and whole-word playback. Consonant selection and comparison are independent of all vowel state. Search/filter resets retain the selected sound and comparison. `/r/` is a search alias for /ɹ/; display and inventory retain /ɹ/.

`consonants.css` scopes the slate-themed cards, filters, pronunciation guides and comparisons to the new mode. The only cross-mode rules are tabs and the explicit hidden boundary. Layout collapses from browser/guide columns to a single column, and comparisons stack on narrow screens. No external fonts or image assets are needed.

## Audio lifecycle

The consonant player lazily creates one HTMLAudioElement on a Hear gesture. Replacement, filtering, selection, mode changes, pagehide and document hiding cancel playback. A generation token invalidates stale playback resolutions and detached callbacks; failures are announced with a retry instruction. Only normal and 0.75× whole-word playback are exposed, with pitch preservation requested from the browser.

The integration adds a narrow `stopVowelAudio` callback to the legacy app. Mode changes pause/reset cached vowel clips, remove repeat handlers, clear playing indicators and the tooltip, and invalidate pending readiness waits, delayed repeats and compare sequences. The legacy window arrow handler calls `isVowelShortcut` to ignore consonant mode, already-handled tab keys, buttons/links, inputs/selects/textareas and contenteditable controls.

Do not rewrite the original vowel renderer or share its selection/search state with consonants. Audio mode boundaries must invalidate pending work, not merely pause the currently active element.

## Content and provenance

Edit `site/data/consonants.json` for the 24 core GA consonants. Each entry supplies a stable key, IPA, example word, half-open highlight interval, manner/place/voicing, mouth instructions, steps, cue, mistake, optional reciprocal counterpart, and word-audio URL. Group approximants together; /l/ is explained as lateral in the guide. Initial /b d g/ need not voice throughout closure, and /ŋ/ is practised finally rather than as an English word onset.

The ten new human recordings have source pages, creators, license links, US-English evidence/caveats, processing descriptions and hashes in `site/data/consonant-audio-sources.json`. Preserve the **CC BY-SA 3.0** adaptation license and embedded ID3 attribution. The manifest covers those ten additions only, not every older word recording. Audio is whole-word speech, not a fabricated isolated consonant; contrast examples must not be labelled minimal pairs unless they actually are. No audio-generation tool is used by this feature.

## Verification

```sh
node --test "tests/*.test.mjs"
```

Existing tests protect vowel comparison and audio completeness. Consonant tests cover inventory, reciprocal counterparts, exact highlights, pedagogical distinctions, combined filters, state, accessible tab behavior and playback cancellation/error paths. Integration tests check panel mounting and legacy shortcut/audio guard wiring. They complement, not replace, browser testing.

Browser regression checklist:

1. Open `/site/` and `/site/#consonants` directly; confirm exactly the intended panel and controls are visible.
2. Use Left/Right/Home/End on tabs, click tabs, and use browser Back/Forward. Verify selected tab, focus and mode remain synchronized.
3. Inspect all 24 cards across five manner groups; select /θ/, /ʒ/, /ŋ/, /ɹ/ and /j/. Check highlights, guide, voiced counterpart and arbitrary contrast.
4. Combine search/manner/place/voice filters, force an empty result, reset, and switch modes twice. Selections and comparison must persist.
5. Hear words at both speeds, replace a playing word, Stop, and change modes while a clip loads or a vowel sequence/repeat waits. No hidden-mode audio should resume.
6. Simulate unavailable data/audio; confirm visible retry guidance and no silent fallback to TTS.
7. Check narrow mobile width, keyboard focus, no horizontal overflow, stacked comparisons, visible focus and reduced-motion preference.
8. Return to vowels and verify existing chart, reference table, anatomy toggles, presets and playback still work.
