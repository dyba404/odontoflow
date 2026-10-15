# Plan de escala Odontoflow (olas 1-3)

> Aprobado 2026-08-20. Doc operativo: `docs/vision-v2.md` contiene la visión
> completa. Este documento define la infraestructura de escala a 100 clínicas.

**Contexto:** objetivo de mercado = 100 clínicas Pro/Premium (fotos/PDFs,
distribución). Situación actual: máquina única del operador + contenedor prod
(v1.8.1) + túnel Cloudflare. Adjuntos en volumen local (~100 GB/mes proyectado
a 100 clínicas). Pool DB `max:4`. Rate-limit in-memory. Cron secuencial con
timeout 300s. Backup: solo `pg_dump` (adjuntos y XML fiscal **sin respaldo**).

**Triggers para mover de ola:** volumen adjuntos >100GB, iowait sostenido >20%,
p95 queries >100ms, o hito de clientes (~50 → ola 2 activa credenciales,
~100 → ola 3 compra VPS).

---

## Ola 1 — v1.10 Blindaje (ejecución actual)

Objetivo: eliminar los riesgos reales ANTES de crecer. Costo ≈ $0-1/mes.

### 1.1 Backup de adjuntos + fiscal off-site (riesgo #1: pérdida total)

- Script `scripts/backup-adjuntos.sh` (corre en WSL dentro del ciclo de backup
  del cron supercronic o como cron de wsl separado, 03:55 — tras el pg_dump):
  ```bash
  DATA=/mnt/c/Users/Administrator/Documents/projects/odontoflow/apps/web/.data
  BACKBLAZE_BUCKET=b2:odontoflow-backups
  rclone copy "$DATA" "$BACKBLAZE_BUCKET/adjuntos" --transfers 4 --checkers 8 \
    --vfs-cache-mode minimal --exclude '*.tmp'
  # carpeta fiscal: apps/web/.data ya contiene fiscal/ dentro; el backup lo cubre
  # muro anti-borrado remotes: rclone sync con --backup-dir para no perder versionado
  ```
- `rclone` ya disponible en WSL (verificar; si no, `apt install rclone` o
  descargar binario estático). Credenciales B2 en `~/.config/rclone/rclone.conf`
  (permiso 600). Bucket: `odontoflow-backups` (crearlo en B2 console, región
  us-west, lifecycle: retener mínimo 1 versión anterior, ~$0.006/GB/mes).
- **Dead-man's switch:** healthchecks.io (free tier, 1 check) — ping al inicio
  (`/start`) y al final (`/` con exit code) desde el script. Configurar en
  `.env.phantoncue` (nunca en repo): `HEALTHCHECKS_URL=https://hc-ping.com/<uuid>`.
- Verificación mensual (manual, runbook): `rclone ls`. Restauración de
  prueba documentada.

### 1.2 Thumbnails sharp (riesgo #2: móvil lento)

- Dependencia: `sharp` (npm). Ya usado indirectamente por Next — verificar.
- En el upload (`POST /api/pacientes/:id/adjuntos`): si el MIME es imagen
  (jpeg/png/webp), además de guardar el original generar:
  - `thumb` 256px WebP q80
  - `preview` 1600px WebP q82
  - Metadata (medidas) en `attachments`.
- En la descarga (`GET /api/adjuntos/:id`): query param `?variant=thumb|preview|original`
  (sin param = original para compat). Content-Type correcto. Los archivos viejos
  (sin thumb) se sirven directos (fallback natural).
- No generar thumbs para PDF/otros. Límite: máx 10MB actual se mantiene.

### 1.3 Pool DB max configurable

- `lib/postgres.ts`: `const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX ?? "10")`.
- Documentar en `.env.proto` y `docker-compose.prod.yml` `web.environment`.
- Nota futura v1.12: con ~100 tenants split app/DB → PgBouncer en modo
  transaction en la máquina DB, pool app sube a 20.

### 1.4 Rate-limit con IP real confiable + webhook protegido

- Verificar en producción hoy la cadena: `cloudflared → caddy → web:3111`.
  Caddy (con `trusted_proxies`) debe pasar X-Forwarded-For real.
- Ajustar `clienteIP(req)` en `whatsapp/webhook/route.ts`: si detrás de proxy
  confiar en X-Forwarded-For primer hop **SOLO** si el remote address directo
  está en la whitelist de red interna (Caddy IP de la docker network). El header
  `x-forwarded-for` no fiable sin esto hoy. Helper `ipDeClienteConfiable(req)`.
- Añadir rate-limit a POST del webhook WhatsApp (por origen + global): cap
  razonable (e.g. 300 req/min) con contador in-memory con expiry 60s. Registrar
  eventos de bloqueo en audit.

### 1.5 Cron recordatorios y campañas en paralelo

- Recordatorios (`recordatorios/route.ts`): loop serial con `await` → cambiar a
  lotes de 5 en paralelo (`Promise.all` por lote de 5, `p-limit` o array
  manual). Timeout del curl cron extendido a 1200s.
- Campañas (`campanas/ejecutar/route.ts`): enviar desde outbox: insertar filas
  `mail_outbox` en la transacción de la campaña (estado pendiente) y job async
  procesa (sin bloquear el request). Cron procesa outbox cada 1 min (paralelo
  batch 3). Se reutiliza para S5 digest matutino.

### 1.6 Observabilidad $0 + límites de memoria

- healthchecks.io: checks sobre `/api/health` cada 5 min (grace 10 min, alerta
  email gratuita). Un check para backup adjuntos (desde 1.1), otro para backup
  pg_dump.
- docker-compose.prod.yml: límites por servicio para que Node no pueda matar a
  Postgres cuando llene heap:
  ```yaml
  web:     deploy.resources.limits.memory: 1536M
  db:      ... 768M
  lycet:   ... 512M
  cron:    ... 128M
  caddy:   ... 128M
  cloudflared: ... 128M
  ```

### 1.7 Tabla "Salud de infra" en `/admin/resumen`

- Sección `Infra` en `admin/resumen/page.tsx` (server component, solo rol admin):
  - último backup pg_dump OK/fail (leer `backups/` o estado guardado)
  - último backup adjuntos (ping healthchecks o timestamp en tabla `infra_backups`)
  - uso de disco del volumen data
  - p95 rough de queries (opcional, v1.11)
- Registro simple: tabla `infra_backups(kind, completed_at, size_bytes, status)`,
  escritura desde los scripts de backup vía API interna con secret compartido.

### Criterio de éxito Ola 1

- [ ] Backup adjuntos off-site corre y pings healthchecks llegan (verificado 1 noche).
- [ ] Adjunto de 5MB sirve preview < 200KB via `?variant=preview`.
- [ ] Pool DB 10 en prod (verificar con `pg_stat_activity`).
- [ ] Webhook WhatsApp no puede ser force-bruteado desde afuera (rate-limit activo).
- [ ] Reminder/campaign batch 5 paralelo; job < 3min con 100 citas activas.
- [ ] Memoria limitada por contenedor (docker stats).
- [ ] Suite E2E + unit tests verdes.

---

## Ola 2 — v1.11 Storage (al llegar a ~50 clínicas)

Objetivo: adjuntos en object storage, uploads sin pasar por Node.

- Interfaz `Storage` en `lib/storage.ts`:
  ```ts
  interface Storage {
    put(key, buf|stream, mime): Promise<void>
    get(key): Promise<ReadableStream | Buffer>
    signGetUrl(key, expiresInSec): Promise<string | null>  // null si no soporta
    signPutUrl(key, mime, expiresInSec): Promise<string | null>
    head(key): Promise<{size} | null>
  }
  ```
  Implementaciones: `LocalStorage` (default actual) y `S3Storage`
  (@aws-sdk/client-s3 + presigner, R2 compatible S3).
- Activación por env: `STORAGE_DRIVER=local|s3` + regionales (endpoint, key,
  secret, bucket, region). Sin credenciales = sigue local sin cambios.
- Uploads presignados: `PUT /api/.../presign` → `Location` con URL presignada;
  el navegador sube directo a R2 (elimina el buffer de 10 MB en Node para
  siempre). Post-upload webhook o confirmación desde cliente.
- Backfill: script `scripts/migrate-attachments-r2` listado `.data/**` → R2
  (con reanudación), marcar `attachments.storage='s3'`.
- Thumbnails: si R2 activo, migrar a **R2 Transformations** (gratis para
  contratos Cloudflare) o `cloudinary-lite` auto. Mantener sharp local como
  fallback.

---

## Ola 3 — v1.12 Dos máquinas (al llegar a ~100 clínicas)

Objetivo: split app/DB con resiliencia incluida.

### 3.1 Topología

- **VPS EU (Hetzner CPX32, ~€9/mes):** contenedor web (Next.js 3111) + cron +
  limiter proxy. Tu máquina local queda como **segundo connector del Cloudflare
  Tunnel** (standby caliente gratis) — si el VPS cae, el túnel sigue sirviendo
  desde tu máquina (solo requiere `cloudflared tunnel run odontoflow` local —
  script `scripts/tunnel-standby.sh`).
- **VPS DB (Hetzner CX33, ~€7/mes):** Postgres 16 + retención audit_logs
  (partición mensual), PgBouncer transaction mode max 100.
- **Storage:** R2 bucket (credenciales ya puestas en Ola 2 activa) — sin disco
  local para adjuntos.

### 3.2 Compose split

- `docker-compose.app.yml` (VPS app) y `docker-compose.db.yml` (VPS db):
  misma imagen web:prod (build desde repo con buildKit remoto). DB conecta por
  **red privada de Hetzner** (no exponer 5432 al internet).
- PITR: `pg_dump` horario → B2 bucket (retención 7d) + WAL archiving al B2
  con `wal-g` o pgBackRest para PITR real. Healthchecks ping por job.
- Cron y supercunic migran al VPS app (con `secrets/crontab-super` hoy).

### 3.3 Migación de datos (cut-over)

1. Configurar B2/R2 credentials.
2. `pg_dump | psql` inicial dump-restore al VPS DB (sequencia por tabla).
3. `rclone sync` adjuntos `.data` → R2 (idempotente).
4. Dry-run: cambiar `PUBLIC_URL` del túnel al VPS app (toggle en
  `cloudflared ingress` con weighto o ~/.cloudflared/config.yml segunda
  regla con testing subdomain).
5. Switchover DB: vaciar tráfico a la app nueva (`DATABASE_URL` apunta al
  VPS DB), freeze writes durante pg_dump sincronizado delta (~minuto).
6. Rollback path documentado: revertir ingreso DB_URL + DNS/ingress.

---

## Resumen de costos

| Componente | Piloto (hoy) | ~50 clínicas | ~100 clínicas |
|---|---|---|---|
| Infra hardware | $0 (máquina casa) | $0 | €16/mes (2 VPS) |
| Cloudflare Tunnel | $0 | $0 | $0 |
| Backblaze B2 (backup) | $0 (free 10GB) | ~$3/mes | ~$7/mes |
| R2 (adjuntos) | $0 (no activado) | ~$10/mes (300GB) | ~$15/mes (500GB) |
| Healthchecks | $0 | $0 | $0 |
| **Total incremental** | **$0** | **~$3/mes** | **~€38/mes** |

Margen: 100 Pro S/199 ≈ S/19,900/mes. Infra = ~1.5%.
