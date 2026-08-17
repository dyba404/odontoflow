# Topología del sistema

## Mapa de superficies

```
Dominio propio (ej. odontoflow.pe / .app — se decide al registrar)
│
├── www.<dominio>         → Landing de marketing (estática)      → Netlify/Vercel free, dominio custom + SSL
├── app.<dominio>         → Consola (dueño / recepción / doctor / asistente) + API
├── r.<dominio>/<clinica> → Página pública de reservas de cada tenant (una URL por clínica)
└── api.<dominio>         → Mismo despliegue de app (monolito Next.js + routes handlers)
        │
   ┌────┴──────────────┬───────────────┬────────────────┬───────────────────┐
   Postgres 16         Contenedor cron Notificaciones    Pagos suscripción   Facturación electrónica
   (composición        6 jobs a /api/  email/SMS         MANUAL (Yape/Plin)  sidecar lycet (Greenter)
    Docker)            cron/*          (Resend free)     panel admin flags   Docker, API REST
```

## Decisiones

- **GitHub Pages: DESCARTADO** (URL `usuario.github.io` visible, atado al perfil personal, solo estático).
  GitHub queda SOLO como repositorio privado del código (GitHub Pro del Student Pack) y portafolio personal.
- **Heroku** cubre app + Postgres con el crédito US$13/mes × 24 meses del Student Pack.
  Dominio custom con SSL (CNAME) sin exponer `herokuapp.com` al usuario final.
- **Landing estática** en Netlify o Vercel free tier con dominio custom (o Appwrite Pro del pack).
- **Monolito Next.js** (apps/web): páginas + API routes. Nada de microservicios hasta que duelan.
- **Sidecar Greenter**: `giansalex/lycet` (MIT, Symfony+Docker) como segundo proceso;
  Node lo llama vía `POST /documents` (implementado; modo `manual` funciona sin él).
- **WhatsApp Cloud API (M4)**: integración oficial, webhook entrante. Cuentas Business por tenant.

## Producción (docker-compose.prod.yml, implementado 2026-08-16)

```
Host (VPS / máquina de despliegue)
├── db     postgres:16 — sin puerto expuesto al host (solo red interna de compose)
├── lycet  sidecar Greenter (facturación electrónica SUNAT), red interna
├── web    Next.js standalone (apps/web/Dockerfile), puerto :3111
│           DATABASE_URL → db:5432 · LYCET_URL → http://lycet:8000/api/v1
└── cron   supercronic v0.2.49 (docker/cron/) — crontab con CRON_TZ=America/Lima
            POST http://web:3111/api/cron/<job> con Bearer $CRON_SECRET
```

- Migraciones / seed: la imagen standalone de `web` no incluye `drizzle-kit` (devDep
  que npm poda), por eso hay un servicio de un solo uso `migrate` (profile `tools`,
  usa el stage `build` del mismo Dockerfile) con el workspace completo:
  `docker compose -f docker-compose.prod.yml run --rm migrate npm run db:migrate`
  (y `... run --rm migrate npm run db:seed`).
- Health check: `GET /api/health` en :3111 → 200/503.
- El cron corre solo desde `compose up`; no hay que programar nada en el host.

Los 6 jobs de `cron` (rutas en `apps/web/src/app/api/cron/*`):

| Job | Frecuencia | Flujo (1 línea) |
|---|---|---|
| `recordatorios` | Cada hora | Recordatorio 24h a citas confirmadas de mañana (email/WhatsApp, fallback email) + reintento de fallidos. |
| `renovaciones` | Cada hora | Suscripción activa vence en ≤3 días → `por_renovar`; aviso el día exacto del vencimiento; +7 días de gracia → `suspendido` (audit en cada paso). |
| `fiscal` | Cada hora | Reintenta vía lycet/SUNAT comprobantes `pendiente_envio` (≤7d) y `rechazados` (≤48h) → `aceptado` o se quedan en `rechazado`. |
| `diario` | Diario 08:00 Lima | Digest al owner: caja, stock bajo, laboratorio, pendientes. |
| `recall` | Diario | Recall automático de pacientes dormidos ≥6 meses por tenant con `recallAuto` activo (dedupe 60 días). |
| `seguimiento` | Diario | Avisos a presupuestos `enviado` con ≥3 días (1er aviso) y ≥7 (final); marca `vencida` las cuotas cuyo vencimiento pasó. |

`scripts/instalar-cron.ps1` queda **dev-only** (programador de tareas de Windows,
`localhost:3111`); en producción lo reemplaza el contenedor `cron`.

## Entorno local de desarrollo (real, implementado 2026-08-15)

```
Windows 11 24H2
├── node / npm / git / código  → C:\Users\Administrator\Documents\projects\odontoflow
└── WSL2: Ubuntu 26.04 LTS (usuario: dev)
    ├── systemd habilitado
    ├── Docker Engine 29.7 + compose plugin 5.4 (repo oficial, target "noble" compat)
    ├── postgres:16 (container odontoflow-db, volumen pgdata)
    │        ↑ expuesto en localhost:5432 (WSL2 forwarding automático)
    └── lycet (container odontoflow-lycet, sidecar Greenter facturación)
             ↑ expuesto en localhost:8090 — Node lo llama vía LYCET_URL
└── Programador de tareas de Windows
    └── Tarea "OfCron": ejecuta el cron (recordatorios, recall, waitlist, campañas,
        reseñas) cada N minutos vía scripts/ + CRON_SECRET
```

- Código en Windows; los contenedores solo corren servicios (nada montado desde Windows en los contenedores, salvo el compose file vía `/mnt/c`).
- `.references/` (gitignored): referencias clonadas — boxyhq/saas-starter-kit (tenancy headless), giansalex/lycet, thegreenter/greenter, clawnify/open-salon, satnaing/shadcn-admin.
- Levantar/parar: `wsl.exe -d Ubuntu -u dev -- sudo docker compose -f /mnt/c/Users/Administrator/Documents/projects/odontoflow/docker-compose.yml up -d` / `wsl.exe --shutdown` (libera RAM y detiene contenedores; reanudan con `docker compose up -d`).
- Conexión desde Windows: `postgres://odontoflow:odontoflow_dev@localhost:5432/odontoflow` (.env.local.example).
- Cron local (DEV-ONLY): tarea programada de Windows `OfCron`/`OfCronDiario` (instalar con `npm run instalar-cron`; requiere `CRON_SECRET`). En producción lo reemplaza el contenedor `cron` con supercronic (ver sección Producción).

## Multi-tenancy

- Single-database con `tenant_id` (=organization_id de BoxyHQ) en TODA query.
- Schema-per-tenant descartado por overhead para un solo dev.
- Middleware server-side: valida sesión + membresía + rol + turno antes de cualquier operación.

## Monorepo local

```
~/Documents/projects/odontoflow/
├── docs/               ← este plan (NO BORRAR, crecer)
├── apps/
│   └── web/            → Next.js (superficies por ruta + API)
├── packages/
│   ├── ui/             → design system (tokens teal, componentes shadcn)
│   ├── core/           → dominio: roles, permisos, estados, reglas de slots, caja
│   └── db/             → schema + migraciones
└── (lycet corre como sidecar Docker vía docker-compose.yml, no como app del monorepo)
```

## Capa de seguridad y PWA (implementado 2026-08-16)

- `apps/web/src/middleware.ts`: headers de seguridad en `/api/*` (HSTS, nosniff, referrer, frame-deny, permissions-policy); no toca DB ni imports del proyecto (edge-safe).
- Rate limiting in-memory (`lib/rate-limit.ts`) en auth pública y endpoints públicos: login 10/min, signup 5/min, recuperar 5/min, solicitudes públicas 10/min, slots 60/min, webhook WhatsApp 30/min → `429` + `Retry-After`.
- `GET /api/health`: `SELECT 1` con timeout 3s → 200/503.
- `scripts/backup.ps1`: `pg_dump` vía WSL/docker → `backups/*.dump` (retención 30 días).
- PWA: `manifest.webmanifest` + `sw.js` (navigations network-first con fallback `offline.html`; cache-first para `/_next/static` e iconos) + banner offline + utilidades IndexedDB (`lib/offline-store.ts`). Detalle en `docs/05-modulos-topologia.md` §15-16.

## Plan de infra a futuro

- Mes 0–24: Heroku crédito + free tiers = costo US$0.
- Con MRR: migrar a VPS (Hetzner ~US$5-10) o Railway; luego `.pe` si el negocio despega.
  El compose de producción (`docker-compose.prod.yml`) es portable: mismo stack, cualquier host con Docker.
- La migración SOLO ocurre cuando haya clientes pagando (nunca antes).
