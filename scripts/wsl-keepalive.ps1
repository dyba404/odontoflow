# wsl-keepalive.ps1 — one-shot heartbeat.
# Touched by Task Scheduler every ~60s. Keeps the WSL2 VM awake and Docker alive.
# Self-healing: if the Ubuntu instance is stopped, it will be restarted on next touch.
try { & wsl.exe -d Ubuntu -e true *>$null } catch {}
try {
  & wsl.exe -d Ubuntu -u dev -e bash -c 'sudo service docker status >/dev/null 2>&1 || sudo service docker start >/dev/null 2>&1 || true' *>$null
} catch {}
