param([int]$Port = 3111)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repoRoot "apps\web"
$node = (Get-Command node).Source
$logDir = Join-Path $env:TEMP "opencode"
$outLog = Join-Path $logDir "next-out.log"
$errLog = Join-Path $logDir "next-err.log"

# El build es output: "standalone": "next start" no esta soportado con esa
# config (aviso en stderr). Se arranca el server standalone oficial, que
# necesita public/ y .next/static/ copiados junto a node_modules/.
# En monorepo el server queda en standalone/apps/web/server.js (igual que
# el Dockerfile de produccion, que corre con WORKDIR /app/apps/web).
$standaloneDir = Join-Path $webRoot ".next\standalone"
$standaloneWeb = Join-Path $standaloneDir "apps\web"
$serverJs = Join-Path $standaloneWeb "server.js"
if (-not (Test-Path -LiteralPath $serverJs)) {
  Write-Output "No hay build standalone: ejecutando npm run build..."
  Push-Location $webRoot
  npm run build
  Pop-Location
}

# Copias requeridas por el modo standalone (public y estaticos)
$pubDest = Join-Path $standaloneWeb "public"
$staticDest = Join-Path $standaloneWeb ".next\static"
if (Test-Path -LiteralPath $pubDest) { Remove-Item $pubDest -Recurse -Force }
if (Test-Path -LiteralPath $staticDest) { Remove-Item $staticDest -Recurse -Force }
Copy-Item -Path (Join-Path $webRoot "public") -Destination $pubDest -Recurse -Force
Copy-Item -Path (Join-Path $webRoot ".next\static") -Destination $staticDest -Recurse -Force

# Variables de entorno: el server standalone no carga apps/web/.env.local por
# su cuenta, asi que se inyectan aqui (misma fuente que `next start`).
$envFile = Join-Path $webRoot ".env.local"
if (Test-Path -LiteralPath $envFile) {
  foreach ($linea in Get-Content -LiteralPath $envFile) {
    if ($linea -match "^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
      $clave = $Matches[1]
      $valor = ($Matches[2] -replace '^"', '' -replace '"$', "").Trim()
      Set-Item -Path "Env:$clave" -Value $valor
    }
  }
}
# La app guarda adjuntos en <cwd>/.data/attachments; el cwd ahora es
# standalone/apps/web, asi que se apunta explicitamente al directorio real.
$env:ATTACHMENTS_DIR = Join-Path $webRoot ".data\attachments"
$env:PORT = "$Port"
$env:HOSTNAME = "0.0.0.0"

# Detener instancia previa sin matar otros procesos node (solo servers
# standalone de ESTA app: el patron incluye "odontoflow" para no tocar el
# server standalone de otros proyectos, p.ej. clinicflow, que comparte el
# mismo patron generico "standalone.apps.web.server.js").
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match "odontoflow.*standalone.apps.web.server.js" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep 1

$proc = Start-Process -FilePath $node -ArgumentList "`"$serverJs`"" `
  -WorkingDirectory $standaloneWeb -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog
Write-Output "Servidor iniciado en silencio (PID $($proc.Id)) -> http://localhost:$Port (logs: $outLog / $errLog)"
