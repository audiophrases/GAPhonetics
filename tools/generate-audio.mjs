import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const dataPath = path.join(repoRoot, 'site', 'data', 'phonemes.json');
const audioPhDir = path.join(repoRoot, 'site', 'audio', 'phonemes');
const audioWdDir = path.join(repoRoot, 'site', 'audio', 'words');
const tmpDir = path.join(repoRoot, 'tools', '.tmp');
const sherpaWrapper = path.join(repoRoot, 'tools', 'sherpa-onnx-tts.cjs');

const force = process.argv.includes('--force');

fs.mkdirSync(audioPhDir, { recursive: true });
fs.mkdirSync(audioWdDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

function slugWord(w) {
  return (w || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ttsToWav(text, wavOut) {
  const r = spawnSync(process.execPath, [sherpaWrapper, '-o', wavOut, text], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`TTS failed (${r.status}) for: ${text}`);
}

function wavToMp3(wavIn, mp3Out) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavIn, '-ac', '1', '-ar', '22050', '-b:a', '128k', mp3Out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status}) for: ${wavIn}`);
}

// Approximate phoneme to speakable syllable
const phonemeSpeak = new Map([
  ['i', 'ee'],
  ['ɪ', 'ih'],
  ['ɪr', 'ear'],
  ['eɪ', 'ay'],
  ['ɛ', 'eh'],
  ['ɛr', 'air'],
  ['ɝ', 'er'],
  ['ɑ', 'ah'],
  ['u', 'oo'],
  ['ʊ', 'oo'],
  ['ʊr', 'tour'],
  ['ʌ', 'uh'],
  ['ə', 'uh'],
  ['oʊ', 'oh'],
  ['ɔ', 'aw'],
  ['ɔr', 'or'],
  ['æ', 'a'],
  ['aʊ', 'ow'],
  ['aʊr', 'hour'],
  ['aɪ', 'eye'],
  ['aɪr', 'ire'],
  ['ɑ2', 'ah'],
  ['ɑr', 'are']
]);

const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const phonemes = json.phonemes || [];

console.log(`Generating audio for ${phonemes.length} phonemes...`);
for (const p of phonemes) {
  const key = String(p.key);
  const safe = encodeURIComponent(key);
  const mp3 = path.join(audioPhDir, `${safe}.mp3`);
  if (fs.existsSync(mp3) && !force) continue;

  let text = phonemeSpeak.get(key);
  if (!text) text = (p.example || [])[0];
  if (!text) text = String(p.ipa || key);

  const wav = path.join(tmpDir, `phoneme-${safe}.wav`);
  console.log(`  [${key}] -> '${text}' -> ${safe}.mp3`);
  ttsToWav(text, wav);
  wavToMp3(wav, mp3);
}

const words = new Set();
for (const p of phonemes) for (const w of (p.example || [])) if (w) words.add(w);

console.log(`Generating audio for ${words.size} words...`);
for (const w of words) {
  const slug = slugWord(w);
  const mp3 = path.join(audioWdDir, `${slug}.mp3`);
  if (fs.existsSync(mp3) && !force) continue;
  const wav = path.join(tmpDir, `word-${slug}.wav`);
  console.log(`  [${w}] -> ${slug}.mp3`);
  ttsToWav(w, wav);
  wavToMp3(wav, mp3);
}

console.log('Done.');
