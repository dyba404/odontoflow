param([int]$Port = 3111)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$nextBin = Join-Path $repoRoot "node_modules\next\dist\bin\next"
$logDir = Join-Path $env:TEMP "opencode"
$outLog = Join-Path $logDir "next-out.log"
$errLog = Join-Path $logDir "next-err.log"

Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
  try { $_.CommandLine -match "3111" } catch { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep 1

$proc = Start-Process -FilePath $node -ArgumentList "`"$nextBin`"","start","-p","$Port" `
  -WorkingDirectory (Join-Path $repoRoot "apps\web") -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog
Write-Output "Servidor iniciado en silencio (PID $($proc.Id)) -> http://localhost:$Port (logs: $outLog / $errLog)"
