param(
  [string]$Port = "3099",
  [string]$DevUrl = "http://localhost:5173",
  [switch]$NoDevServer,
  [string]$ExtensionPath = "",
  [string]$Model = "openrouter/google/gemma-4-e2b"
)

if (-not $NoDevServer) {
  Write-Host "Starting Vite dev server..." -ForegroundColor Cyan
  $devJob = Start-Job -ScriptBlock { npm run dev }
  Start-Sleep -Seconds 3
}

$mcpArgs = @("--port", $Port)
if ($ExtensionPath) {
  $mcpArgs += @("--extension", $ExtensionPath)
}

Write-Host "Starting Playwright MCP on port $Port..." -ForegroundColor Cyan
$mcpJob = Start-Job -ScriptBlock { param($a) npx @playwright/mcp @a } -ArgumentList $mcpArgs
Start-Sleep -Seconds 2

Write-Host @"
QA Agent ready.
  Dev server: $DevUrl
  Playwright MCP: ws://localhost:$Port
  Model: $Model

Run your QA prompt:
  opencode run "QA verify the Analysis Hub at $DevUrl" --model $Model
  opencode run (Get-Content qa_prompts\verify-analysis-hub.md -Raw) --model $Model

Press Ctrl+C to stop.
"@ -ForegroundColor Green

try {
  while ($true) { Start-Sleep -Seconds 10 }
}
finally {
  Write-Host "Shutting down..." -ForegroundColor Yellow
  $mcpJob | Stop-Job -PassThru | Remove-Job
  if (-not $NoDevServer) { $devJob | Stop-Job -PassThru | Remove-Job }
}
