# General American Phonetics — interactive charts

This is a simple static site (HTML/CSS/JS) that renders **three synchronized interactive charts** like the provided screenshot:

1. Tile vowel map (black background)
2. Reference table (symbol/example/tongue/lips/length)
3. Vowel quadrilateral (front/central/back × high/mid/low)

## Run locally

From this folder:

```powershell
python -m http.server 5173
```

Then open:

- http://localhost:5173/src/

(We use a local server so `fetch()` can load `data/phonemes.json`.)

## Edit phoneme data

- `data/phonemes.json`

Each entry has placements:
- `tile`: grid row/column for the tile chart
- `quad`: x/y in the SVG coordinate space (520×360)

Next step: replace the starter dataset and placements to match the screenshot exactly.
