param(
  [switch]$SkipBuild,
  [switch]$SkipPublish
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
Set-StrictMode -Version Latest

$root = (Resolve-Path "$PSScriptRoot\..").Path
$releaseDir = Join-Path $root "release"

function Invoke-Checked {
  param([Parameter(Mandatory = $true)][string]$Label, [scriptblock]$Body)
  & $Body
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed (exit $LASTEXITCODE)"
  }
}

# --- Read version from manifest (single source of truth) ---
$manifest = Get-Content -LiteralPath (Join-Path $root "src\extension\manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version
$zipName = "Artemis_Quiver_extension-v$version.zip"
$zipPath = Join-Path $releaseDir $zipName

Write-Host "Releasing Artemis Quiver v$version"

# --- Build ---
if (-not $SkipBuild) {
  Write-Host "`n[1/4] Building extension..."
  Push-Location $root
  try {
    Invoke-Checked "npm run build:ext" { npm run build:ext }
  } finally { Pop-Location }
  if (-not (Test-Path -LiteralPath $zipPath)) {
    throw "Expected zip not found: $zipPath"
  }
} else {
  Write-Host "`n[1/4] Skipping build (expected zip: $zipPath)"
  if (-not (Test-Path -LiteralPath $zipPath)) {
    throw "Expected zip not found: $zipPath. Run without -SkipBuild first."
  }
}

# --- Commit + tag ---
Write-Host "`n[2/4] Committing and tagging v$version in main repo..."
Push-Location $root
try {
  $existing = git tag -l "v$version"
  if ([string]::IsNullOrWhiteSpace($existing)) {
    Invoke-Checked "git tag" { git tag -a "v$version" -m "Artemis Quiver v$version" }
  } else {
    Write-Warning "Tag v$version already exists locally - skipping tag creation"
  }

  Invoke-Checked "git push origin main" { git push origin main }
  Invoke-Checked "git push tag" { git push origin "v$version" }
} finally { Pop-Location }

# --- Publish GitHub Release ---
if ($SkipPublish) {
  Write-Host "`n[3/4] Skipped publish (-SkipPublish). Push + tag done."
  exit 0
}

Write-Host "`n[3/4] Publishing GitHub Release v$version..."
$notes = @"
Artemis Quiver v$version — see the main CHANGELOG for details.

**Install:** download the zip → unzip → chrome://extensions → Load unpacked → select the folder. Open the web app once for profile fingerprint + error relay. Configure an LLM in the app Settings (local LM Studio/Ollama, WebLLM in-browser, or cloud API key).
"@
$notes = $notes.Trim()

Push-Location $root
try {
  Invoke-Checked "gh release create" { gh release create "v$version" $zipPath --title "Artemis Quiver v$version" --notes $notes }
} finally { Pop-Location }

Write-Host "`nDone. Release published."