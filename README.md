# General American Phonetics (GAPhonetics)

Interactive General American Phonetics charts.

## Run locally

From repo root:

```powershell
python -m http.server 5173
```

Open:

- http://localhost:5173/site/

## Live (GitHub Pages)

This repo includes a GitHub Actions workflow that deploys `./site` to GitHub Pages on every push to `main`.
After the first deploy, the site will be available at:

- https://audiophrases.github.io/GAPhonetics/

## Project structure

- `site/` — static website (HTML/CSS/JS)
- `site/data/phonemes.json` — phoneme inventory + placements + examples
- `site/audio/` — audio files (add your recordings here)

## Audio files (expected paths)

- Phoneme audio: `site/audio/phonemes/<key>.mp3`
- Word audio: `site/audio/words/<slug>.mp3`

(If a file is missing, the UI will show a disabled play button.)
