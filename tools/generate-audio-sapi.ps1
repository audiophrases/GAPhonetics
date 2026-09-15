<#
Fallback word-audio generator using the Windows built-in speech synthesizer.

The primary pipeline (generate-audio.mjs / generate-audio.ps1) needs the
sherpa-onnx Piper runtime. When that is not installed, this script fills in
any *missing* site/audio/words/<slug>.mp3 for the example words listed in
site/data/phonemes.json. Existing clips are never overwritten.

Voice: Microsoft Zira (en-US, female) — closest register to the Piper voice
used for the existing clips. Output is trimmed of leading/trailing silence,
padded lightly and level-matched, then encoded like the existing files
(mono, 44.1 kHz, 128 kbps MP3). Requires ffmpeg on PATH.

Usage:  pwsh tools/generate-audio-sapi.ps1 [-Voice "Microsoft Zira"] [-Words fire,saw]
#>
param(
  [string]$Voice = "Microsoft Zira",
  [string[]]$Words = @()
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $repoRoot "site\data\phonemes.json"
$audioWdDir = Join-Path $repoRoot "site\audio\words"
$tmpDir = Join-Path $repoRoot "tools\.tmp"
New-Item -ItemType Directory -Force -Path $audioWdDir, $tmpDir | Out-Null

function SlugWord([string]$w) {
  return ($w.ToLower().Trim() -replace "[^a-z0-9]+", "-" -replace "(^-|-$)", "")
}

if ($Words.Count -eq 0) {
  $json = Get-Content $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $set = New-Object System.Collections.Generic.HashSet[string]
  foreach ($p in $json.phonemes) { foreach ($w in ($p.example | Where-Object { $_ })) { [void]$set.Add($w) } }
  $Words = @($set)
}

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = -1

# Trim silence at both ends, pad ~60 ms, lift ~3 dB to match the Piper clips.
$filters = "silenceremove=start_periods=1:start_threshold=-45dB," +
           "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse," +
           "asetpts=N/SR/TB,adelay=60|60,apad=pad_dur=0.06,volume=3dB"

$made = 0
foreach ($w in $Words) {
  $slug = SlugWord $w
  $mp3 = Join-Path $audioWdDir "$slug.mp3"
  if (Test-Path $mp3) { continue }

  $wav = Join-Path $tmpDir "sapi-$slug.wav"
  Write-Host "  [$w] -> $slug.mp3 ($Voice)"
  $synth.SetOutputToWaveFile($wav)
  $synth.Speak($w)
  $synth.SetOutputToNull()

  # ffmpeg may print a one-off "non monotonically increasing dts" warning from the
  # mp3 muxer after areverse; the output decodes correctly regardless.
  & ffmpeg -y -hide_banner -loglevel error -i $wav -af $filters -ac 1 -ar 44100 -b:a 128k $mp3
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $w" }
  $made++
}
$synth.Dispose()
Write-Host "Done. $made new clip(s) in $audioWdDir"
