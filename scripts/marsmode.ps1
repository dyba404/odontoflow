# marsmode.ps1 — Prender/apagar el "servidor" marsmode.me (WSL2 + Docker prod)
#
# El stack de produccion (app.marsmode.me) vive en Docker dentro de WSL2 de esta
# misma maquina. WSL consume ~4 GB de RAM (vmmemWSL) aunque nadie este usando la
# app; este script libera esa RAM apagando todo, y la vuelve a prender cuando se
# necesite (dominio publico operativo de nuevo).
#
#   .\scripts\marsmode.ps1 on      # enciende WSL + Docker + stack prod + tunel
#   .\scripts\marsmode.ps1 off     # apaga TODO y libera la RAM (vmmemWSL=0)
#   .\scripts\marsmode.ps1 status  # diagnostico sin cambiar nada
#
# COMO FUNCIONA EL OFF (sin falsos positivos):
#   1. Detiene y apaga la tarea programada OdontoFlow-WSL-Boot (el keep-alive
#      "sleep infinity" que sostiene la VM viva). Si no se apaga, el trigger de
#      repeticion cada 1 min RELANZA WSL a los pocos segundos de apagarlo.
#   2. Mata sesiones wsl.exe de keep-alive (sleep infinity / tail /dev/null).
#   3. docker compose -f docker-compose.prod.yml --profile tunnel down (contenedores
#      ordenados; los datos en volumenes se conservan intactos).
#   4. wsl.exe --shutdown -> la VM se descarga y vmmemWSL desaparece (RAM libre).
#
# COMO FUNCIONA EL ON:
#   1. wsl -e true (enciende la VM).
#   2. sudo service docker start (el arranque de la distro NO levanta docker
#      automaticamente: /etc/wsl.conf no tiene boot-command).
#   2b. SOLO odontoflow: los contenedores de otros proyectos (stack dev de
#      docker-compose.yml, clinicflow, etc.) tienen restart: unless-stopped y el
#      daemon los auto-enciende al arrancar; se les quita esa politica y se
#      detienen para que solo corra el stack prod.
#   3. docker compose -f docker-compose.prod.yml --profile tunnel up -d
#      (web espera healthchecks de db y lycet; cloudflared publica el tunel).
#   4. Reactiva la tarea OdontoFlow-WSL-Boot (keep-alive anti-flapping).
#   5. Sondas: docker ps + https://app.marsmode.me/api/health hasta 200 (o timeout).
#
# Requisito puntual: ejecutar desde PowerShell con permiso para las tareas
# programadas (una consola de administrador, igual que configurar-keepalive-wsl.ps1).

param(
    [Parameter(Position = 0)]
    [ValidateSet("on", "off", "status", "help")]
    [string]$cmd = "help"
)

$ErrorActionPreference = "Continue"

$raiz = Split-Path $PSScriptRoot -Parent
$composeWin = Join-Path $raiz "docker-compose.prod.yml"
# Ruta dentro de WSL (el repo vive en /mnt/c/...).
$composeWsl = "/mnt/c/Users/Administrator/Documents/projects/odontoflow/docker-compose.prod.yml"
$tarea = "OdontoFlow-WSL-Boot"
$healthUrl = "https://app.marsmode.me/api/health"

# WSL a veces devuelve el texto UTF-16 con espacios entre letras y falla con
# error transitorio de socket (0x80072747) bajo presion de memoria.
function Wsl([string]$inner, [int]$timeoutSeg = 120) {
    $job = Start-Job -ScriptBlock {
        param($i) & wsl.exe -d Ubuntu -u dev -- bash -c $i 2>&1
    } -ArgumentList $inner
    if (Wait-Job $job -Timeout $timeoutSeg) {
        $out = Receive-Job $job
        Remove-Job $job -Force
        return ($out | Out-String).Trim()
    }
    Stop-Job $job; Remove-Job $job -Force
    return $null
}

function Get-VmmemMb {
    $p = Get-Process vmmem, vmmemWSL -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($p) { return [math]::Round($p.WorkingSet64 / 1MB) }
    return 0
}

function Get-WslProcesosKeepAlive {
    # Procesos wsl.exe cuyo unico proposito es mantener la VM despierta.
    Get-CimInstance Win32_Process -Filter "Name = 'wsl.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -match "sleep infinity|tail -f /dev/null|keepalive"
        }
}

function Test-TareaActiva {
    $t = Get-ScheduledTask -TaskName $tarea -ErrorAction SilentlyContinue
    if (-not $t) { return $false }
    # Disabled = apagada a mano; Ready sin correr = puede relanzar en el proximo tick.
    return ($t.State -ne "Disabled")
}

function Stop-KeepAlive {
    # 1. Apaga la tarea programada para que ningun trigger relance la VM.
    try {
        $t = Get-ScheduledTask -TaskName $tarea -ErrorAction Stop
        Stop-ScheduledTask -TaskName $tarea -ErrorAction SilentlyContinue
        Disable-ScheduledTask -TaskName $tarea -ErrorAction Stop | Out-Null
        Write-Host "[off] Tarea '$tarea' detenida y desactivada (no se relanza sola)." -ForegroundColor Green
    } catch {
        Write-Host "[off] Tarea '$tarea' no existe o ya esta desactivada." -ForegroundColor DarkGray
    }
    # 2. Mata sesiones wsl.exe de keep-alive vivas.
    $procs = Get-WslProcesosKeepAlive
    foreach ($p in $procs) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { }
    }
    if ($procs) {
        Write-Host ("[off] {0} sesion(es) keep-alive terminadas." -f @($procs).Count) -ForegroundColor Green
    }
}

function Invoke-Off {
    Write-Host "=== marsmode OFF: apagando servidor y liberando RAM ===" -ForegroundColor Cyan
    Stop-KeepAlive

    # Contenedores down (ordenado, conservando volumenes) si WSL responde.
    $estado = Wsl "echo vivo" 20
    if ($estado -eq "vivo") {
        Write-Host "[off] Bajando stack prod (docker compose down)..." -ForegroundColor Cyan
        $out = Wsl "sudo docker compose -f $composeWsl --profile tunnel down" 180
        if ($null -eq $out) { Write-Host "[off] docker compose down no respondio (se sigue)." -ForegroundColor Yellow }
    } else {
        Write-Host "[off] WSL no responde; el shutdown lo limpiara igual." -ForegroundColor Yellow
    }

    # Shutdown: descarga la VM; vmmemWSL desaparece y la RAM queda libre.
    Write-Host "[off] wsl.exe --shutdown (liberando RAM)..." -ForegroundColor Cyan
    wsl.exe --shutdown
    Start-Sleep 3

    # Verificacion honesta (lo que importa al usuario: la RAM).
    $mb = Get-VmmemMb
    $vivas = @(Get-WslProcesosKeepAlive).Count
    $tareaActiva = Test-TareaActiva
    if ($mb -eq 0 -and $vivas -eq 0 -and -not $tareaActiva) {
        Write-Host ("[off] LISTO: RAM liberada (vmmemWSL={0} MB), sin keep-alive, tarea apagada." -f $mb) -ForegroundColor Green
        Write-Host "[off] marsmode.me quedara con 530 hasta que corras: .\scripts\marsmode.ps1 on" -ForegroundColor Yellow
    } else {
        Write-Host ("[off] ATENCION: vmmemWSL={0} MB, keep-alive vivos={1}, tarea activa={2}." -f $mb, $vivas, $tareaActiva) -ForegroundColor Yellow
        Write-Host "[off] Si vmmemWSL sigue >0, revisa procesos wsl.exe y repite off." -ForegroundColor Yellow
    }
}

function Invoke-On {
    Write-Host "=== marsmode ON: encendiendo servidor ===" -ForegroundColor Cyan

    # 1. Encender la VM.
    Write-Host "[on] Encendiendo WSL/Ubuntu..." -ForegroundColor Cyan
    $null = Wsl "echo vivo" 60
    if (-not (Get-Process vmmem, vmmemWSL -ErrorAction SilentlyContinue)) {
        Write-Host "[on] ERROR: la VM WSL no arranco." -ForegroundColor Red
        return
    }

    # 2. Docker daemon (la distro no lo levanta sola al encender).
    Write-Host "[on] Asegurando daemon Docker..." -ForegroundColor Cyan
    $null = Wsl "sudo service docker start; sudo service docker status" 90

    # 2b. Solo odontoflow: detiene y desactiva el auto-arranque de contenedores
    # ajenos al proyecto prod (stack dev/clinicflow) que el daemon acaba de
    # encender por restart: unless-stopped. Script bash aparte para evitar el
    # infierno de quoting de PS -> wsl.exe -> bash (los filtros label!= llegan
    # rotos al daemon: "invalid filter 'label!'").
    Write-Host "[on] Deteniendo contenedores ajenos a prod (dev/clinicflow)..." -ForegroundColor Cyan
    $soloProd = "/mnt/c/Users/Administrator/Documents/projects/odontoflow/scripts/marsmode-solo-prod.sh"
    $quedan = Wsl "sudo bash $soloProd odontoflow-prod" 180
    if ($null -eq $quedan) {
        Write-Host "[on] AVISO: limpieza de stacks ajenos no respondio; se sigue." -ForegroundColor Yellow
    }

    # 3. Stack prod completo + tunel (cloudflared, perfil tunnel).
    Write-Host "[on] Levantando stack prod (db, lycet, web, caddy, cloudflared, cron, mailpit, whatsmock)..." -ForegroundColor Cyan
    $out = Wsl "sudo docker compose -f $composeWsl --profile tunnel up -d" 420
    if ($null -eq $out) {
        Write-Host "[on] ERROR: docker compose up no respondio (420s)." -ForegroundColor Red
        return
    }
    $out -split "`n" | Select-Object -Last 12 | ForEach-Object { Write-Host "      $_" }

    # 4. Keep-alive anti-flapping (la misma proteccion de sesion 28).
    $t = Get-ScheduledTask -TaskName $tarea -ErrorAction SilentlyContinue
    if ($t) {
        Enable-ScheduledTask -TaskName $tarea | Out-Null
        if (-not (Get-WslProcesosKeepAlive)) { Start-ScheduledTask -TaskName $tarea }
        Write-Host "[on] Keep-alive '$tarea' reactivado." -ForegroundColor Green
    } else {
        Write-Host "[on] AVISO: tarea '$tarea' no existe; ejecuta configurar-keepalive-wsl.ps1." -ForegroundColor Yellow
    }

    # 5. Sondas: contenedores y health publico.
    Write-Host "[on] Esperando healthchecks (db/lycet/web) y tunel..." -ForegroundColor Cyan
    $ps = $null
    for ($i = 0; $i -lt 30; $i++) {
        $ps = Wsl "sudo docker ps --format '{{.Names}}|{{.Status}}' --filter label=com.docker.compose.project=odontoflow-prod" 60
        if ($null -ne $ps -and $ps -match "odontoflow-web-prod\|Up") { break }
        Start-Sleep 5
    }
    if ($null -eq $ps) { Write-Host "[on] AVISO: docker ps no respondio; revisa 'status'." -ForegroundColor Yellow }
    else { $ps -split "`n" | ForEach-Object { if ($_.Trim()) { Write-Host "      $_" } } }

    $ok = $false
    for ($i = 0; $i -lt 24; $i++) {   # hasta 120 s de gracia para el tunel
        try {
            $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
            if ($r.StatusCode -eq 200) { $ok = $true; break }
        } catch { }
        Start-Sleep 5
    }
    if ($ok) {
        Write-Host "[on] LISTO: https://app.marsmode.me respondiendo 200." -ForegroundColor Green
    } else {
        Write-Host "[on] Contenedores arriba, pero el health publico no respondio 200 (tunel puede tardar)." -ForegroundColor Yellow
        Write-Host "[on] Reintenta en un minuto o revisa: wsl -d Ubuntu -u dev -- sudo docker logs odontoflow-cloudflared-prod" -ForegroundColor Yellow
    }
}

function Invoke-Status {
    Write-Host "=== marsmode status ===" -ForegroundColor Cyan
    $mb = Get-VmmemMb
    if ($mb -gt 0) {
        Write-Host ("VM WSL:     ENCENDIDA ({0} MB RAM en vmmemWSL)" -f $mb) -ForegroundColor Green
    } else {
        Write-Host "VM WSL:     APAGADA (0 MB)" -ForegroundColor Red
    }
    Write-Host ("Tarea keep-alive '$tarea': " + $(if (Test-TareaActiva) { "activa" } else { "apagada/desactivada" }))
    $vivas = @(Get-WslProcesosKeepAlive).Count
    Write-Host "Sesiones keep-alive vivas: $vivas"

    if ($mb -gt 0) {
        $ps = Wsl "sudo docker ps --format '{{.Names}}|{{.Status}}' --filter label=com.docker.compose.project=odontoflow-prod" 45
        if ($null -eq $ps -or -not $ps.Trim()) {
            Write-Host "Contenedores prod: ninguno corriendo (o docker no responde)." -ForegroundColor Yellow
        } else {
            Write-Host "Contenedores prod:"
            $ps -split "`n" | ForEach-Object { if ($_.Trim()) { Write-Host "  $_" } }
        }
        try {
            $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
            Write-Host ("Health publico: HTTP {0}" -f $r.StatusCode) -ForegroundColor Green
        } catch {
            Write-Host "Health publico: sin respuesta (tunel caido o app aun calentando)." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Contenedores/health: no consultados (VM apagada)." -ForegroundColor DarkGray
    }
}

switch ($cmd) {
    "on"     { Invoke-On }
    "off"    { Invoke-Off }
    "status" { Invoke-Status }
    "help" {
        Get-Content $MyInvocation.PSCommandPath | Select-Object -First 10
    }
}
