# Configura la tarea programada "OdontoFlow-WSL-Boot" que mantiene viva la
# distro WSL (Ubuntu) donde corre el stack de produccion de Odontoflow.
#
# Problema que resuelve: cuando la ultima sesion interactiva de WSL termina,
# wslservice apaga la instancia por inactividad ("systemctl poweroff" colgado ->
# force kill, ver InitTerminateInstanceInternal en el event log). Eso mata
# dockerd y todos los contenedores: app.marsmode.me queda en 530/502 hasta el
# proximo acceso manual. El .wslconfig con vmIdleTimeout=-1 no siempre se
# honra sin un wsl --shutdown previo.
#
# Solucion: sesion persistente lanzada OCULTA via keepalive-sesion.vbs
# (wscript no aloca consola -> no hay ventana que cerrar por accidente).
# MultipleInstances IgnoreNew + triggers logon/repeticion 1 min como red de
# seguridad: si el sleeper muere, el siguiente tick lo relanza solo.
#
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configurar-keepalive-wsl.ps1

$ErrorActionPreference = "Stop"

$nombre = "OdontoFlow-WSL-Boot"
$vbs = Join-Path $PSScriptRoot "keepalive-sesion.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
$triggerLoop = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::FromDays(3650))
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

$existente = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
if ($existente) {
  Set-ScheduledTask -TaskName $nombre -Action $action -Trigger @($triggerLogon, $triggerLoop) -Settings $settings | Out-Null
  Write-Output "tarea '$nombre' actualizada (lanzamiento oculto via VBS)"
} else {
  Register-ScheduledTask -TaskName $nombre -Action $action -Trigger @($triggerLogon, $triggerLoop) -Settings $settings | Out-Null
  Write-Output "tarea '$nombre' creada (lanzamiento oculto via VBS)"
}

Get-Process -Name wsl -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -ne $null } | Out-Null

Start-ScheduledTask -TaskName $nombre
Write-Output "sesion persistente oculta iniciada (wscript -> wsl sleep infinity)"
