$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
Set-StrictMode -Version Latest

$root = (Resolve-Path "$PSScriptRoot\..").Path

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
$tag = "v$version"

Write-Host "Releasing Artemis Quiver $tag"
Write-Host "Build + publish happen in GitHub Actions (.github/workflows/release.yml) once the tag is pushed."

Push-Location $root
try {
  $existing = git tag -l $tag
  if ([string]::IsNullOrWhiteSpace($existing)) {
    Invoke-Checked "git tag" { git tag -a $tag -m "Artemis Quiver $tag" }
  } else {
    Write-Warning "Tag $tag already exists locally - skipping tag creation"
  }

  Invoke-Checked "git push main" { git push Main main }
  Invoke-Checked "git push tag" { git push Main $tag }
} finally { Pop-Location }

Write-Host "`nPushed. Watch the release run: gh run watch (or the Actions tab on GitHub)."
