$ErrorActionPreference = "Stop"

Write-Host "Iniciando respaldo de base de datos Odontoflow..."

$wslCmd = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wslCmd) {
    Write-Host "ERROR: wsl.exe no esta disponible en este equipo." -ForegroundColor Red
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backupsDir = Join-Path $repoRoot "backups"
if (-not (Test-Path -LiteralPath $backupsDir)) {
    Write-Host "Creando carpeta de respaldos: $backupsDir"
    New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

Write-Host "Ejecutando pg_dump dentro del contenedor odontoflow-db..."
& wsl.exe -d Ubuntu -u dev -- docker exec odontoflow-db pg_dump -U odontoflow -d odontoflow -Fc -f /tmp/odontoflow_backup.dump
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pg_dump fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

$marca = Get-Date -Format "yyyyMMdd_HHmmss"
$archivoLocal = Join-Path $backupsDir ("odontoflow_backup_" + $marca + ".dump")

Write-Host "Copiando respaldo fuera del contenedor..."
& cmd /c ("wsl.exe -d Ubuntu -u dev -- docker cp odontoflow-db:/tmp/odontoflow_backup.dump - > `"" + $archivoLocal + "`"")
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: la copia del respaldo fallo con codigo $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

if (-not (Test-Path -LiteralPath $archivoLocal)) {
    Write-Host "ERROR: no se genero el archivo local del respaldo." -ForegroundColor Red
    exit 1
}

Write-Host "Limpiando archivo temporal dentro del contenedor..."
& wsl.exe -d Ubuntu -u dev -- docker exec odontoflow-db rm -f /tmp/odontoflow_backup.dump

Write-Host "Eliminando respaldos locales con mas de 30 dias..."
$antiguos = Get-ChildItem -Path $backupsDir -Filter "odontoflow_backup_*.dump" -File |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }
foreach ($viejo in $antiguos) {
    Remove-Item -LiteralPath $viejo.FullName -Force
    Write-Host ("Eliminado: " + $viejo.Name)
}

Write-Host "Respaldo completado: $archivoLocal" -ForegroundColor Green
exit 0
