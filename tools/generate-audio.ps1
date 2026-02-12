param(
  [string]$Model = "piper",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $repoRoot "site\data\phonemes.json"
$audioPhDir = Join-Path $repoRoot "site\audio\phonemes"
$audioWdDir = Join-Path $repoRoot "site\audio\words"
$tmpDir = Join-Path $repoRoot "tools\.tmp"

New-Item -ItemType Directory -Force -Path $audioPhDir, $audioWdDir, $tmpDir | Out-Null

# Local CommonJS wrapper (avoids Node ESM resolution issues)
$ttsWrapper = Join-Path $repoRoot "tools\sherpa-onnx-tts.cjs"
if (!(Test-Path $ttsWrapper)) {
  throw "sherpa wrapper not found at $ttsWrapper"
}

function SlugWord([string]$w) {
  return ($w.ToLower().Trim() -replace "[^a-z0-9]+", "-" -replace "(^-|-$)", "")
}

function TtsToWav([string]$text, [string]$wavOut) {
  # Windows note from skill: run via node
  $args = @($ttsWrapper, "-o", $wavOut, $text)
  & node @args | Out-Null
}

function WavToMp3([string]$wavIn, [string]$mp3Out) {
  & ffmpeg -y -hide_banner -loglevel error -i $wavIn -ac 1 -ar 22050 -b:a 128k $mp3Out | Out-Null
}

# Basic phoneme -> speakable syllable mapping (approximation)
# Goal: immediate functional audio for every tile.
# NOTE: we build keys using Unicode code points so the script works even if the file encoding is not UTF-8.
$phonemeSpeak = @{}

# ASCII
$phonemeSpeak["i"]   = "ee"
$phonemeSpeak["u"]   = "oo"
# (diphthongs are added below using codepoint-safe keys)
$phonemeSpeak["ɑ2"]  = "ah"

# Helpers
function S([int[]]$cps){ return -join ($cps | ForEach-Object { [char]$_ }) }

# IPA characters
$I_SmallCap = 0x026A  # ɪ
$E_Open     = 0x025B  # ɛ
$R_Hooked   = 0x025D  # ɝ
$Alpha      = 0x0251  # ɑ
$U_Horseshoe= 0x028A  # ʊ
$TurnedV    = 0x028C  # ʌ
$Schwa      = 0x0259  # ə
$OpenO      = 0x0254  # ɔ
$Ash        = 0x00E6  # æ
$SmallUHook = 0x028A  # ʊ
$SmallOU    = 0x028A
$SmallO     = 0x006F  # o
$SmallA     = 0x0061  # a
$SmallE     = 0x0065  # e
$SmallR     = 0x0072  # r

$U_Hook = 0x028A
$TurnedM = 0x02B7

$UpArrow = 0x028A

# Diphthong tail ʊ
$Upsilon = 0x028A

# ʊ codepoint is 0x028A; use it for diphthongs oʊ, aʊ
$phonemeSpeak[(S @($I_SmallCap))]                 = "ih"
$phonemeSpeak[(S @($I_SmallCap, $SmallR))]        = "ear"
$phonemeSpeak[(S @($SmallE, $I_SmallCap))]        = "ay"   # eɪ
$phonemeSpeak[(S @($E_Open))]                     = "eh"
$phonemeSpeak[(S @($E_Open, $SmallR))]            = "air"
$phonemeSpeak[(S @($R_Hooked))]                   = "er"
$phonemeSpeak[(S @($Alpha))]                      = "ah"
$phonemeSpeak[(S @($U_Horseshoe))]                = "oo"
$phonemeSpeak[(S @($U_Horseshoe, $SmallR))]       = "tour"
$phonemeSpeak[(S @($TurnedV))]                    = "uh"
$phonemeSpeak[(S @($Schwa))]                      = "uh"
$phonemeSpeak[(S @($SmallO, $Upsilon))]           = "oh"   # oʊ
$phonemeSpeak[(S @($OpenO))]                      = "aw"
$phonemeSpeak[(S @($OpenO, $SmallR))]             = "or"
$phonemeSpeak[(S @($Ash))]                        = "a"
$phonemeSpeak[(S @($SmallA, $Upsilon))]           = "ow"   # aʊ
$phonemeSpeak[(S @($SmallA, $Upsilon, $SmallR))]  = "hour" # aʊr
$phonemeSpeak[(S @($SmallA, $I_SmallCap))]        = "eye"  # aɪ
$phonemeSpeak[(S @($SmallA, $I_SmallCap, $SmallR))]= "ire"  # aɪr
$phonemeSpeak[(S @($Alpha, $SmallR))]             = "are"  # ɑr

$json = Get-Content $dataPath -Raw | ConvertFrom-Json
$phonemes = $json.phonemes

Write-Host "Generating audio for $($phonemes.Count) phonemes..."

foreach ($p in $phonemes) {
  $key = $p.key
  $ipa = $p.ipa
  $safeKey = [uri]::EscapeDataString([string]$key)
  $mp3 = Join-Path $audioPhDir ("$safeKey.mp3")

  if ((Test-Path $mp3) -and -not $Force) {
    continue
  }

  $text = $phonemeSpeak[$key]
  if (-not $text) { $text = ($p.example | Select-Object -First 1) }
  if (-not $text) { $text = $ipa }

  $wav = Join-Path $tmpDir ("phoneme-$safeKey.wav")
  Write-Host "  [$key] -> '$text'"
  TtsToWav $text $wav
  WavToMp3 $wav $mp3
}

# words
$words = New-Object System.Collections.Generic.HashSet[string]
foreach ($p in $phonemes) {
  foreach ($w in ($p.example | Where-Object { $_ })) {
    [void]$words.Add($w)
  }
}

Write-Host "Generating audio for $($words.Count) words..."
foreach ($w in $words) {
  $slug = SlugWord $w
  $mp3 = Join-Path $audioWdDir ("$slug.mp3")
  if ((Test-Path $mp3) -and -not $Force) {
    continue
  }
  $wav = Join-Path $tmpDir ("word-$slug.wav")
  Write-Host "  [$w] -> $slug.mp3"
  TtsToWav $w $wav
  WavToMp3 $wav $mp3
}

Write-Host "Done. Audio output:"
Write-Host "  $audioPhDir"
Write-Host "  $audioWdDir"
