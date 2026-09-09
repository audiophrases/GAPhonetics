import json

articulatory_map = {
    "i": {
        "tongue": "High Front: Tongue blade arches high toward the hard palate near the alveolar ridge.",
        "jaw": "High / nearly closed (narrow gap between incisors).",
        "lips": "Unrounded, spread into a slight smile.",
        "cue": "Sides of the tongue press firmly against upper molars. Pharynx and throat cavity stay wide and relaxed."
    },
    "ɪ": {
        "tongue": "High-Mid Front (Lax): Tongue body is slightly lower and more central than /i/, with relaxed muscle tension.",
        "jaw": "Slightly more open than /i/ (relaxed jaw drop).",
        "lips": "Unrounded and relaxed.",
        "cue": "Relax the tongue and jaw from the /i/ position. Sound feels centered in the high-front mouth."
    },
    "ɪr": {
        "tongue": "Starts in high-front /ɪ/ position, then tongue body retracts and curls/bunches into the rhotic pocket.",
        "jaw": "Narrow to mid opening.",
        "lips": "Unrounded, transitioning to slight lip flare.",
        "cue": "Tongue sweeps from high-front lax position backward toward the palate for the /r/ finish."
    },
    "eɪ": {
        "tongue": "Diphthong Glide: Starts at mid-front /e/ and moves smoothly upward toward high-front /ɪ/.",
        "jaw": "Starts mid-open and raises upward as the glide finishes.",
        "lips": "Unrounded, spreading progressively wider.",
        "cue": "Feel the upward jaw movement and tongue blade gliding upward toward the hard palate."
    },
    "ɛ": {
        "tongue": "Mid Front: Tongue body sits at half-height in the front oral cavity, below the hard palate.",
        "jaw": "Mid-open (approx. one finger width between front teeth).",
        "lips": "Unrounded and neutral.",
        "cue": "Tongue blade is arched mid-level; sides lightly contact upper rear teeth."
    },
    "ɛr": {
        "tongue": "Starts at mid-front /ɛ/ and glides directly into the bunched or retroflex rhotic /r/.",
        "jaw": "Mid-open, closing slightly during the glide.",
        "lips": "Neutral, transitioning to slight lip protrusion.",
        "cue": "Hold the open /ɛ/ position, then bunch the back of the tongue or curl the tip for the rhotic resonance."
    },
    "ɝ": {
        "tongue": "Stressed Rhotic: Tongue body bunches high in the central palate with tip curled (retroflex) or bunched back.",
        "jaw": "Mid-high opening with active muscular tension.",
        "lips": "Moderately rounded with slight flaring of lips.",
        "cue": "Dual constriction in palate and pharynx creates the strong General American /r/ acoustic resonance."
    },
    "ɚ": {
        "tongue": "Unstressed Rhotic (schwa+r): Same bunched or retroflex posture as /ɝ/, but quick, unstressed, and light.",
        "jaw": "Mid, relaxed opening.",
        "lips": "Neutral to slightly rounded.",
        "cue": "Unstressed syllables (water, actor). Tongue touches the rhotic pocket lightly and briefly."
    },
    "ɑ": {
        "tongue": "Low-Front/Central Anchor [a]: Lowest point of the front-to-back arc, starting anchor for /aɪ/ and /aʊ/.",
        "jaw": "Wide open (two finger widths).",
        "lips": "Unrounded and neutral.",
        "cue": "Open base anchor sound for General American open diphthongs."
    },
    "u": {
        "tongue": "High Back: Tongue dorsum arches high toward the velum (soft palate) at the back of the mouth.",
        "jaw": "High / almost closed.",
        "lips": "Tightly rounded and protruded into a small circle.",
        "cue": "Tongue pulls far back toward the soft palate/uvula while lips make a tight circular tube."
    },
    "ʊ": {
        "tongue": "High-Mid Back (Lax): Tongue dorsum is slightly lower and less retracted than /u/, muscles relaxed.",
        "jaw": "Slightly more open than /u/.",
        "lips": "Loosely rounded, not tightly pursed.",
        "cue": "Relax lips and tongue from the /u/ position (foot, look, put)."
    },
    "ʊr": {
        "tongue": "Starts in high-back lax /ʊ/ position and transitions into central rhotic bunched /r/.",
        "jaw": "Mid-narrow opening.",
        "lips": "Rounded, maintaining active lip engagement throughout.",
        "cue": "Glides from rounded back cavity inward to the central rhotic constriction (tour, cure)."
    },
    "ʌ": {
        "tongue": "Mid Central / Back-Central (Stressed): Tongue body sits at relaxed mid height, slightly back of center.",
        "jaw": "Mid-low opening, relaxed mandible.",
        "lips": "Completely unrounded and neutral.",
        "cue": "Short, punchy stressed vowel in the center-back of the mouth (sun, cup, blood)."
    },
    "ə": {
        "tongue": "Mid Central (Schwa): Neutral vocal tract; tongue rests in the exact center of the mouth without tension.",
        "jaw": "Mid-neutral, minimum muscular effort.",
        "lips": "Completely relaxed, neutral.",
        "cue": "The lazy default resting posture of English; zero muscular strain (ago, the)."
    },
    "oʊ": {
        "tongue": "Diphthong Glide: Starts at mid-back /o/ and glides upward and backward toward /ʊ/.",
        "jaw": "Starts mid-open and raises upward.",
        "lips": "Rounded at start, becoming tighter and more protruded as the sound finishes.",
        "cue": "Feel both jaw closing and lip circle shrinking as you say 'no', 'go', 'boat'."
    },
    "ɔ": {
        "tongue": "Mid Back (Open-Mid): Tongue body pulled back toward the posterior pharyngeal wall and lower velum.",
        "jaw": "Mid-low opening.",
        "lips": "Moderately rounded (oval aperture).",
        "cue": "Acoustic resonance feels deep in the throat/pharynx with distinct lip rounding (dog, law)."
    },
    "ɔr": {
        "tongue": "Starts with rounded mid-back /ɔ/ and glides smoothly into the central rhotic bunched /r/.",
        "jaw": "Mid-open to mid.",
        "lips": "Maintains rounding through to the rhotic finish.",
        "cue": "Prominent General American vowel in words like 'warm', 'door', 'form'."
    },
    "æ": {
        "tongue": "Low Front: Tongue blade lies low and forward behind the lower teeth; pharynx narrows slightly.",
        "jaw": "Open / low (mandible dropped wide).",
        "lips": "Unrounded, corners pulled back slightly.",
        "cue": "Tongue tip touches lower front teeth while tongue body stays low and flat in front (cat, hat, ash)."
    },
    "aʊ": {
        "tongue": "Diphthong Glide: Starts low in front/center /a/ and travels diagonally upward to high-back /ʊ/.",
        "jaw": "Drops wide open on start, then closes upward noticeably.",
        "lips": "Starts completely unrounded/open, finishes tightly rounded.",
        "cue": "Dramatic full-mouth articulatory travel: from wide open flat tongue to high rounded back (cow, loud)."
    },
    "aʊr": {
        "tongue": "Triphthong Glide: Starts low /a/, sweeps through back /ʊ/, and finishes in central rhotic /r/.",
        "jaw": "Wide open at start, closes upward.",
        "lips": "Starts neutral, rounds, then relaxes into rhotic shape.",
        "cue": "Multi-stage articulatory movement heard in words like 'hour', 'sour'."
    },
    "aɪ": {
        "tongue": "Diphthong Glide: Starts low in front/center /a/ and glides upward toward high-front /ɪ/.",
        "jaw": "Starts wide open and closes upward toward the upper incisors.",
        "lips": "Starts neutral/unrounded, widens into a smile.",
        "cue": "Tongue sweeps up the front of the mouth from lowest floor to hard palate (sky, fly, time)."
    },
    "aɪr": {
        "tongue": "Triphthong Glide: Starts low /a/, glides toward front /ɪ/, then sweeps to central rhotic /r/.",
        "jaw": "Wide open, raises, then stabilizes.",
        "lips": "Unrounded, transitions to slight rhotic posture.",
        "cue": "Triple transition heard in 'wire', 'fire', 'tire'."
    },
    "ɑ2": {
        "tongue": "Low Back: Tongue body pulled all the way back and down into the lower pharynx / throat.",
        "jaw": "Maximum low opening / wide dropped jaw.",
        "lips": "Completely unrounded, neutral opening.",
        "cue": "Doctor's visit 'say Ah': tongue flat and retracted low, opening the entire oral cavity (top, spa, father)."
    },
    "ɑr": {
        "tongue": "Starts at low back /ɑ/ and glides into bunched or retroflex rhotic /r/.",
        "jaw": "Wide open at start, closes slightly.",
        "lips": "Neutral unrounded at start, slight flare for /r/ finish.",
        "cue": "Classic 'car', 'hard', 'arm' vowel in General American."
    }
}

glide_map = {
    "eɪ": {"from": "eɪ", "to": "ɪ", "path": ["eɪ", "ɪ"]},
    "aɪ": {"from": "ɑ", "to": "ɪ", "path": ["ɑ", "ɪ"]},
    "aʊ": {"from": "ɑ", "to": "ʊ", "path": ["ɑ", "ʊ"]},
    "oʊ": {"from": "oʊ", "to": "ʊ", "path": ["oʊ", "ʊ"]},
    "ɪr": {"from": "ɪ", "to": "ɚ", "path": ["ɪ", "ɚ"]},
    "ɛr": {"from": "ɛ", "to": "ɚ", "path": ["ɛ", "ɚ"]},
    "ʊr": {"from": "ʊ", "to": "ɚ", "path": ["ʊ", "ɚ"]},
    "ɔr": {"from": "ɔ", "to": "ɚ", "path": ["ɔ", "ɚ"]},
    "ɑr": {"from": "ɑ2", "to": "ɚ", "path": ["ɑ2", "ɚ"]},
    "aɪr": {"from": "ɑ", "to": "ɚ", "path": ["ɑ", "ɪ", "ɚ"]},
    "aʊr": {"from": "ɑ", "to": "ɚ", "path": ["ɑ", "ʊ", "ɚ"]}
}

path = "site/data/phonemes.json"
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

for p in data.get("phonemes", []):
    key = p.get("key")
    if key in articulatory_map:
        p["articulatory"] = articulatory_map[key]
    if key in glide_map:
        p["glide"] = glide_map[key]

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("phonemes.json successfully updated with articulatory and glide data!")
