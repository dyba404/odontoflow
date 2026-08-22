' Sesion WSL persistente SIN ventana visible (keep-alive de Odontoflow).
' Lanzada por la tarea programada "OdontoFlow-WSL-Boot" via
' scripts/configurar-keepalive-wsl.ps1. Con esta sesion viva, wslservice
' nunca dispara el apagado por inactividad que mata los contenedores.
' Si el proceso muere, el trigger de repeticion (cada 1 min) lo relanza.
Set sh = CreateObject("WScript.Shell")
sh.Run """wsl.exe"" -d Ubuntu --exec sleep infinity", 0, False
