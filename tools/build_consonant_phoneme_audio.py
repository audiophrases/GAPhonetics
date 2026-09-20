import urllib.request, json, pathlib, ssl, re, time, html, urllib.parse, urllib.error
import soundfile as sf
import numpy as np
import lameenc
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TCOP, TXXX, COMM

mapping = {
    'p': {'sym': 'p', 'file': 'File:Voiceless bilabial plosive.ogg'},
    'b': {'sym': 'b', 'file': 'File:Voiced bilabial plosive.ogg'},
    't': {'sym': 't', 'file': 'File:Voiceless alveolar plosive.ogg'},
    'd': {'sym': 'd', 'file': 'File:Voiced alveolar plosive.ogg'},
    'k': {'sym': 'k', 'file': 'File:Voiceless velar plosive.ogg'},
    'g': {'sym': 'ɡ', 'file': 'File:Voiced velar plosive 02.ogg'},
    'f': {'sym': 'f', 'file': 'File:Voiceless labio-dental fricative.ogg'},
    'v': {'sym': 'v', 'file': 'File:Voiced labio-dental fricative.ogg'},
    'θ': {'sym': 'θ', 'file': 'File:Voiceless dental fricative.ogg'},
    'ð': {'sym': 'ð', 'file': 'File:Voiced dental fricative.ogg'},
    's': {'sym': 's', 'file': 'File:Voiceless alveolar sibilant.ogg'},
    'z': {'sym': 'z', 'file': 'File:Voiced alveolar sibilant.ogg'},
    'ʃ': {'sym': 'ʃ', 'file': 'File:Voiceless palato-alveolar sibilant.ogg'},
    'ʒ': {'sym': 'ʒ', 'file': 'File:Voiced palato-alveolar sibilant.ogg'},
    'h': {'sym': 'h', 'file': 'File:Voiceless glottal fricative.ogg'},
    'tʃ': {'sym': 't̠ʃ', 'file': 'File:Voiceless palato-alveolar affricate.ogg'},
    'dʒ': {'sym': 'd̠ʒ', 'file': 'File:Voiced palato-alveolar affricate.ogg'},
    'm': {'sym': 'm', 'file': 'File:Bilabial nasal.ogg'},
    'n': {'sym': 'n', 'file': 'File:Alveolar nasal.ogg'},
    'ŋ': {'sym': 'ŋ', 'file': 'File:Velar nasal.ogg'},
    'l': {'sym': 'l', 'file': 'File:Alveolar lateral approximant.ogg'},
    'ɹ': {'sym': 'ɹ', 'file': 'File:Alveolar approximant.ogg'},
    'j': {'sym': 'j', 'file': 'File:Palatal approximant.ogg'},
    'w': {'sym': 'w', 'file': 'File:Voiced labio-velar approximant.ogg'}
}

ctx = ssl.create_default_context()
UA = 'GAPhonetics/1.0 (educational pronunciation app; Wikimedia attribution preserved)'

def plain(value: str) -> str:
    value = html.unescape(value or '')
    value = re.sub(r'<br\s*/?>', '; ', value, flags=re.I)
    value = re.sub(r'<[^>]+>', '', value)
    return re.sub(r'\s+', ' ', value).strip()

titles = [v['file'] for v in mapping.values()]
api = 'https://commons.wikimedia.org/w/api.php?action=query&prop=videoinfo&inprop=url&viprop=url|derivatives|mime|size|extmetadata&format=json&titles=' + '|'.join(urllib.parse.quote(t) for t in titles)

req = urllib.request.Request(api, headers={'User-Agent': UA})
with urllib.request.urlopen(req, context=ctx) as r:
    data = json.loads(r.read().decode('utf-8'))

pages = data.get('query', {}).get('pages', {})
meta_by_title = {}
for pid, page in pages.items():
    t = page.get('title')
    vi = (page.get('videoinfo') or [{}])[0]
    em = vi.get('extmetadata') or {}
    mv = lambda k: plain((em.get(k) or {}).get('value', ''))
    mp3 = next((d['src'] for d in vi.get('derivatives', []) if d.get('type') == 'audio/mpeg'), '')
    meta_by_title[t] = {
        'title': t,
        'page_url': vi.get('descriptionurl', ''),
        'original_url': vi.get('url', ''),
        'mp3_url': mp3,
        'artist': mv('Artist') or 'Wikimedia Commons contributor',
        'credit': mv('Credit'),
        'license': mv('LicenseShortName') or 'CC BY-SA 3.0',
        'license_url': mv('LicenseUrl') or 'http://creativecommons.org/licenses/by-sa/3.0/',
        'description': mv('ImageDescription')
    }

dest_dir = pathlib.Path('site/audio/phonemes')
dest_dir.mkdir(parents=True, exist_ok=True)
tmp_dir = pathlib.Path('tools/.tmp')
tmp_dir.mkdir(parents=True, exist_ok=True)

def trim_silence(audio: np.ndarray, sr: int, pad_ms: float = 30.0) -> np.ndarray:
    peak = float(np.max(np.abs(audio)))
    if peak <= 1e-7:
        return audio
    threshold = peak * 10 ** (-45 / 20)
    active = np.flatnonzero(np.abs(audio) >= threshold)
    if not len(active):
        return audio
    pad = int(sr * pad_ms / 1000)
    start = max(0, int(active[0]) - pad)
    end = min(len(audio), int(active[-1]) + pad + 1)
    return audio[start:end]

def normalize(audio: np.ndarray, target_rms_db: float = -20.0, peak_limit_db: float = -1.0) -> np.ndarray:
    rms = float(np.sqrt(np.mean(np.square(audio, dtype=np.float64))))
    if rms <= 1e-8:
        return audio
    target_rms = 10 ** (target_rms_db / 20)
    peak_limit = 10 ** (peak_limit_db / 20)
    gain = target_rms / rms
    peak = float(np.max(np.abs(audio)))
    if peak * gain > peak_limit:
        gain = peak_limit / peak
    return (audio * gain).astype(np.float32)

def encode_mp3(audio: np.ndarray, sr: int, destination: pathlib.Path) -> None:
    audio = np.clip(audio, -1, 1)
    pcm = (audio * 32767.0).round().astype('<i2').tobytes()
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(128)
    encoder.set_in_sample_rate(sr)
    encoder.set_channels(1)
    encoder.set_quality(2)
    data = encoder.encode(pcm) + encoder.flush()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)

sources_summary = []

def download_file(url: str, dest: pathlib.Path) -> None:
    if dest.exists() and dest.stat().st_size > 100:
        return
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
                data = resp.read()
                if len(data) > 100:
                    dest.write_bytes(data)
                    return
        except urllib.error.HTTPError as exc:
            delay = int(exc.headers.get('Retry-After', 0) or 0) or min(60, 4 * (2 ** attempt))
            print(f"HTTP {exc.code} for {url}; retrying in {delay}s...")
            time.sleep(delay)
        except Exception as e:
            print(f"Error {e} for {url}; retrying in 5s...")
            time.sleep(5)
    raise RuntimeError(f"Failed to download {url}")

for k, v in mapping.items():
    t = v['file'].replace('File:', '')
    found_key = next((tk for tk in meta_by_title if tk.endswith(t)), None)
    meta = meta_by_title[found_key]
    dl_url = meta['mp3_url'] if meta['mp3_url'] else meta['original_url']
    tmp_file = tmp_dir / f"{k}-src{pathlib.Path(dl_url.split('?')[0]).suffix}"
    
    download_file(dl_url, tmp_file)
    time.sleep(1.0)
    
    audio, sr = sf.read(tmp_file, dtype='float32', always_2d=True)
    mono = audio.mean(axis=1)
    trimmed = trim_silence(mono, sr)
    norm = normalize(trimmed)
    
    # Save both unencoded key and URL-encoded key if different
    out_paths = [dest_dir / f'{k}.mp3']
    enc_k = urllib.parse.quote(k)
    if enc_k != k:
        out_paths.append(dest_dir / f'{enc_k}.mp3')
        
    for out_path in out_paths:
        encode_mp3(norm, sr, out_path)
        
        # ID3 tagging
        tags = ID3()
        artist = meta['artist']
        tags.add(TIT2(encoding=3, text=f"/{k}/ consonant phoneme pronunciation"))
        tags.add(TPE1(encoding=3, text=artist))
        tags.add(TALB(encoding=3, text='GAPhonetics IPA Consonant Reference'))
        tags.add(TCOP(encoding=3, text=f"{meta['license']} — {meta['license_url']}"))
        tags.add(TXXX(encoding=3, desc='TARGET', text=f"/{k}/"))
        tags.add(TXXX(encoding=3, desc='COMMONS_TITLE', text=meta['title']))
        tags.add(TXXX(encoding=3, desc='ORIGINAL_URL', text=meta['original_url']))
        tags.add(TXXX(encoding=3, desc='LICENSE', text=meta['license']))
        tags.add(TXXX(encoding=3, desc='LICENSE_URL', text=meta['license_url']))
        tags.add(COMM(encoding=3, lang='eng', desc='Attribution', text=(
            f"Source: {meta['page_url']} | Creator: {artist} | "
            f"License: {meta['license']} {meta['license_url']}"
        )))
        tags.save(out_path, v2_version=3)
        
    sources_summary.append({
        'key': k,
        'ipa': k,
        'file_title': meta['title'],
        'page_url': meta['page_url'],
        'original_url': meta['original_url'],
        'artist': meta['artist'],
        'license': meta['license'],
        'license_url': meta['license_url'],
        'duration_seconds': round(len(norm) / sr, 3)
    })
    print(f"Done /{k}/ -> {meta['title']} ({round(len(norm) / sr, 3)}s)")

summary_path = pathlib.Path('site/data/consonant-phoneme-audio-sources.json')
summary_path.write_text(json.dumps({'consonant_phonemes': sources_summary}, indent=2, ensure_ascii=False), encoding='utf-8')
print('Finished all 24 consonant phonemes!')
