# Scripts

## setup-post-reboot.ps1
Ejecutar DESPUES del reinicio, en PowerShell con admin (o doble clic).
Idempotente: puede re-ejecutarse si algo falla a la mitad.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-post-reboot.ps1
```

### Que hace
1. Verifica WSL (`wsl --status`)
2. Instala Ubuntu si no existe (usuario `dev`, sin pedir interaccion)
3. Habilita systemd + sudo NOPASSWD en Ubuntu
4. Instala Docker Engine + compose plugin (repo oficial Docker)
5. Corre `docker run --rm hello-world` para verificar
6. Clona los 5 repos de referencia en `.references/` (si faltan)

Cuando termine con exito: abrir opencode en `C:\Users\Administrator\Documents\projects\odontoflow`
y decir `continua` para retomar con Drizzle/DB + M1.
