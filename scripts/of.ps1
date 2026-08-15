# of.ps1 — asistente del entorno OdontoFlow (WSL + Docker + Postgres + Web)
# Uso:
#   .\scripts\of.ps1 up       # levanta WSL + Docker + Postgres (idempotente)
#   .\scripts\of.ps1 down     # detiene los contenedores (no borra datos)
#   .\scripts\of.ps1 status   # estado de todo
#   .\scripts\of.ps1 ssh      # shell interactiva de Ubuntu
#   .\scripts\of.ps1 db       # psql dentro del contenedor
#   .\scripts\of.ps1 logs     # ultimos logs de Postgres
#   .\scripts\of.ps1 restart  # apaga y vuelve a levantar

param(
    [Parameter(Position = 0)]
    [ValidateSet("up", "down", "status", "ssh", "db", "logs", "restart", "help")]
    [string]$cmd = "status"
)

$ErrorActionPreference = "Continue"
$compose = "/mnt/c/Users/Administrator/Documents/projects/odontoflow/docker-compose.yml"

function Wsl([string]$inner) {
    wsl.exe -d Ubuntu -u dev -- bash -c $inner
}

function EnsureDocker {
    # Arranca el daemon si esta caido y sube el contenedor de Postgres.
    Wsl "sudo service docker status >/dev/null 2>&1 || sudo service docker start" *> $null
}

switch ($cmd) {
    "up" {
        Write-Host "[of] Levantando WSL/Ubuntu..." -ForegroundColor Cyan
        wsl.exe -d Ubuntu -e true *> $null
        EnsureDocker
        Write-Host "[of] Levantando Postgres..." -ForegroundColor Cyan
        Wsl "sudo docker compose -f $compose up -d" 2>&1 | Select-Object -Last 2
        Write-Host "[of] Esperando que Postgres acepte conexiones..." -ForegroundColor Cyan
        $ok = $false
        for ($i = 0; $i -lt 20; $i++) {
            $r = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
            if ($r) { $ok = $true; break }
            Start-Sleep 2
        }
        if ($ok) {
            Write-Host "[of] Listo. Postgres en localhost:5432" -ForegroundColor Green
        } else {
            Write-Host "[of] Postgres no respondio. Revisa con: of logs" -ForegroundColor Red
        }
    }
    "down" {
        Write-Host "[of] Deteniendo contenedores..." -ForegroundColor Cyan
        Wsl "sudo docker compose -f $compose stop" 2>&1 | Select-Object -Last 2
        Write-Host "[of] Contenedores detenidos (los datos se conservan)." -ForegroundColor Green
    }
    "restart" {
        & "$PSScriptRoot\of.ps1" down
        Start-Sleep 2
        & "$PSScriptRoot\of.ps1" up
    }
    "status" {
        Write-Host "=== WSL ===" -ForegroundColor Cyan
        wsl.exe --list --running 2>$null
        Write-Host "`n=== Docker (Postgres) ===" -ForegroundColor Cyan
        Wsl "sudo docker ps --format '{{.Names}}  {{.Status}}'" 2>&1
        $pg = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($pg) {
            Write-Host "`nPostgres: ESCUCHANDO en localhost:5432" -ForegroundColor Green
        } else {
            Write-Host "`nPostgres: NO disponible. Ejecuta: of up" -ForegroundColor Red
        }
    }
    "ssh" {
        Write-Host "[of] Abriendo shell de Ubuntu (exit para salir)..." -ForegroundColor Cyan
        wsl.exe -d Ubuntu -u dev
    }
    "db" {
        Write-Host "[of] psql (exit/quit para salir)..." -ForegroundColor Cyan
        wsl.exe -d Ubuntu -u dev -- bash -c "sudo docker exec -it odontoflow-db psql -U odontoflow -d odontoflow"
    }
    "logs" {
        Wsl "sudo docker logs odontoflow-db --tail 40" 2>&1
    }
    "help" {
        Get-Content $MyInvocation.PSCommandPath | Select-Object -First 12
    }
}
