# Runbook de producción — host casero

Producción actual: `docker-compose.prod.yml` en WSL2 dentro de esta misma máquina,
publicada por Cloudflare Tunnel (`app.marsmode.me`). Regla de oro:

> **Ninguna actualización sin backup fresco antes de tocar nada.**

## 1. Actualizar la app (deploy de código nuevo)

```powershell
# 0. Código al día (el repo ya está en GitHub)
git pull origin main

# 1. BACKUP manual ANTES de construir (además del diario automático)
wsl -d Ubuntu -u dev -- sudo docker exec odontoflow-prod-db \
  pg_dump -U odontoflow -d odontoflow -Fc -f /tmp/pre_deploy.dump
wsl -d Ubuntu -u dev -- sudo docker cp odontoflow-prod-db:/tmp/pre_deploy.dump ./backups/
# → ./backups está gitignored; retención manual: borrar dumps >30 días

# 2. Reconstruir SOLO el contenedor web (db/lycet/cron siguen corriendo)
npm run of:status   # verificar que docker esté arriba
wsl -d Ubuntu -u dev -- bash -lc "cd /mnt/c/Users/Administrator/Documents/projects/odontoflow && sudo docker compose -f docker-compose.prod.yml up -d --build web"

# 3. Migraciones SI el deploy incluye migraciones nuevas:
wsl -d Ubuntu -u dev -- bash -lc "cd /mnt/c/Users/Administrator/Documents/projects/odontoflow && sudo docker compose -f docker-compose.prod.yml run --rm migrate npm run db:migrate"
#    (siempre DESPUÉS del paso 1; si la migración rompe, restore del dump)

# 4. Verificación post-deploy (orden importa)
curl https://app.marsmode.me/api/health          # 200 con db:true
curl -s https://app.marsmode.me | head           # landing carga
node scripts/e2e-funcional.js                    # suite completa contra prod
```

## 2. Rollback si algo sale mal

```bash
# Volver a la imagen anterior (quedó etiquetada como dangling):
sudo docker images | grep odontoflow-web        # anotar ID anterior
# Re-etiquetar y reiniciar:
sudo docker tag <ID_ANTERIOR> odontoflow-web:prod
sudo docker compose -f docker-compose.prod.yml up -d --no-deps web

# Si la BD quedó dañada por una migración (última instancia):
sudo docker exec -i odontoflow-prod-db pg_restore -U odontoflow -d odontoflow --clean --if-exists < backups/<dump>.dump
```

## 3. Qué NUNCA hacer

- `docker compose down -v` — borra volúmenes (pacientes, citas, TODO).
- Cambiar `LOCAL_MASTER_KEY` — deja ilegibles Clave SOL/certificados/tokens WhatsApp.
- Migrar sin el dump del paso 1.
- Apagar la tarea `OdontoFlow-WSL-Boot` (mantiene viva la VM; sin ella los
  contenedores mueren por inactividad — ver sesión 28).

## 4. Backups — qué existe y qué falta

| Capa | Estado |
|---|---|
| pg_dump diario 03:40 Lima → `./backups` (30 días) | ✅ automático |
| tar.gz adjuntos+fiscal 04:00 → `./backups` | ✅ automático |
| healthchecks.io avisa si un backup no corre | ⏳ crear cuenta gratuita y pegar URLs en `HEALTHCHECK_DB`/`HEALTHCHECK_OFFSITE` |
| Copia OFF-SITE real (otro edificio) | ⏳ mientras prod vive aquí, copiar semanalmente `./backups` a un disco externo o nube (rclone a B2/R2 ~$1-2/mes) |

La restauración completa fue probada (sesión 11). El punto único de fallo hoy es
esta casa: el off-site lo elimina.

## 5. Cambiar de dominio (ej. marsmode.me → odontoflow.me)

Todo es parametrizable; el cambio son 3 sitios + DNS:

1. DNS del nuevo dominio: registro `A app.nuevodominio → IP pública` o CNAME al
   túnel (Cloudflare gestiona ambos).
2. `.env`: `NEXT_PUBLIC_APP_URL=https://app.nuevodominio`, `APP_DOMAIN=app.nuevodominio`,
   `WWW_DOMAIN=www.nuevodominio`.
3. Ingress del túnel (dashboard Zero Trust o config local): hostname nuevo → `http://web:3111`.
4. Resend: re-verificar dominio para `RESEND_FROM` (nuevo SPF/DKIM).
5. `up -d --no-deps web caddy cloudflared` y verificación del paso 1.4.

## 6. Migración futura a VPS serio (cuando haya clientes pagando)

Candidato verificado 2026-08: **Oracle Cloud Free Tier** (siempre gratis, no expira):

- ARM Ampere A1: **2 OCPU / 12 GB RAM** (recortado desde 4/24 en jun-2026, aún
  sobrado para este stack: los mem_limits suman ~3.5 GB)
- 200 GB disco, 10 TB/mes de egreso, IPv4 pública incluida
- Ojo: región permanente al crear la cuenta (elegir São Paulo o cercana),
  tarjeta solo para verificación, capacidad A1 a veces "Out of capacity" (reintentar),
  instancias idle pueden ser reclamadas (este workload no lo es)
- Las imágenes deben buildearse para ARM64 (`docker buildx`) — postgres/caddy/next
  tienen variantes arm64 oficiales; validar lycet/whap en arm64 antes de migrar

Alternativa paga cuando hay MRR: Hetzner CPX21 (~€8/mes, x86, sin sorpresas).
El procedimiento completo está en `docs/08-plan-escala.md`; el resumen:
crear VPS → instalar Docker → `git clone` → mismo `.env` (misma LOCAL_MASTER_KEY)
→ `pg_dump` aquí → restore allá → cambiar DNS → apagar túnel.
