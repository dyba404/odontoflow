# Odontoflow

[![CI](https://github.com/dyba404/odontoflow/actions/workflows/ci.yml/badge.svg)](https://github.com/dyba404/odontoflow/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-core%20%2B%20E2E%20Playwright-brightgreen)](docs/12-sdd-openspec.md)

SaaS de gestión para consultorios odontológicos en Perú (MYPE masivo). Agenda, pacientes,
ficha clínica, caja, facturación, inventario y más. Multi-tenant con roles por staff.
**En producción real** (Docker Compose en host propio + Cloudflare Tunnel).

## Características

- **Agenda** con engine de slots propio, bloqueos y protocolos de corrección.
- **Ficha clínica** con odontograma e historial por paciente.
- **Caja y facturación electrónica SUNAT** (boleta/factura) vía sidecar lycet (Greenter), con reemisión automática de comprobantes rechazados.
- **Inventario** con kardex y digest diario de stock bajo.
- **Portal del paciente** con login.
- **WhatsApp Cloud API**: recordatorios de citas y seguimiento de presupuestos.
- **Suscripciones** (Free/Pro/Premium) con ciclo automático: renovación, días de gracia y suspensión.
- **Multi-tenant** con RBAC server-side y `tenant_id` forzado en toda query.
- **6 cron jobs** (recordatorios, renovaciones, fiscal, digest, recall de pacientes dormidos, seguimiento).
- Cifrado at-rest de credenciales fiscales y tokens de WhatsApp (`LOCAL_MASTER_KEY`).

## Stack

Next.js 15 (App Router) · TypeScript · Drizzle ORM · PostgreSQL 16 · monorepo npm workspaces ·
Docker Compose · GitHub Actions · tests core (`node:test`) + E2E Playwright · Resend · Caddy + cloudflared.

## Documentación (índice completo)

Contexto siempre-cargado (reglas):
- `AGENTS.md` — reglas siempre-cargadas para agentes (contexto pasivo)
- `constitution.md` — principios inmutables (C1-C7)

Proceso SDD:
- `docs/12-sdd-openspec.md` — proceso obligatorio (OpenSpec: specs + changes)
- `openspec/` — specs de verdad actual (6 dominios) + changes en curso

Por tema (un tema = un doc):
- `docs/00-resumen.md` — decisiones clave
- `docs/01-topologia.md` — arquitectura y despliegue
- `docs/02-roadmap.md` — fases M0→M5 + backlog post-M5 (incluido en 1.0)
- `docs/03-roles-diseno.md` — roles, permisos, superficies, privacidad
- `docs/04-modelo-datos.md` — schema multi-tenant
- `docs/05-modulos-topologia.md` — topología por módulo (facturación, inventario, etc.)
- `docs/06-estados-protocolos.md` — máquinas de estado y protocolos de deshacer/corrección
- `docs/07-soporte-plataforma.md` — panel operador fundador auditado
- `docs/08-plan-escala.md` — programa de escala (olas 1-3: blindaje, storage, multi-máquina)
- `docs/09-vision-v2.md` — visión v2.0.0: hallazgos, arquitectura, olas 4-6
- `docs/10-capacitacion.md` — guion del video demo + capacitación por rol
- `docs/11-marketing-piloto.md` — kit de marketing piloto (canales, copy, métricas)
- `docs/13-repos-referencia.md` — matriz de tools/repositories verificada (fuentes 2026-09)
- `docs/99-sesion-estado.md` — estado de sesiones, punto de reanudación
- `docs/actualizar-produccion.md` — runbook de producción en host casero (backup, rollback)

## Estructura

```
apps/web                → Next.js 15 (superficies por rol + API, puerto 3111)
apps/web/src/vendor/    → react-advanced-odontogram vendoreado (ESM-only)
packages/ui             → design system (tokens teal)
packages/core           → dominio (roles, permisos, estados, engine de slots, tests)
packages/db             → schema Drizzle multi-tenant + migraciones + seed
scripts/                → utilidades Docker/DB/console + marsmode (prender/apagar prod)
.github/workflows/      → CI (typecheck, lint, tests core/web, escáner mojibake)
.references/            → 18 repos clonados como material de investigación (read-only)
openspec/               → proceso SDD: specs de verdad actual + changes
docker-compose.yml      → desarrollo local: Postgres 16 + sidecar lycet (Greenter) + Mailpit + whatsmock
docker-compose.prod.yml → producción: db + lycet + web (Next standalone) + caddy + cloudflared + cron
docker/cron/            → crontab + Dockerfile del contenedor cron (supercronic)
demo-ui/                → demo navegable sin backend (gitignored; entregable separado para clientes)
```

## Setup

```
docker compose up -d          # DEV: Postgres :5432 + lycet :8090 + Mailpit :8025
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3111
```

Copia `.env.local.example` a `.env.local` y ajusta según la tabla de variables de entorno.

## Producción (Docker Compose, host casero)

`docker-compose.prod.yml` levanta el stack completo: `db` (Postgres 16, sin puerto expuesto al
host), `lycet` (sidecar Greenter), `web` (Next.js standalone en :3111), `cron`
(supercronic v0.2.49), `caddy`, `cloudflared` (túnel), `mailpit` y `whatsmock`.

```
docker compose -f docker-compose.prod.yml up -d --build                  # levantar stack
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:migrate  # migraciones
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:seed     # seed demo
curl http://localhost:3111/api/health                                    # health check (200/503)
```

Prender/apagar todo el servidor (libera la RAM de WSL): `scripts/marsmode.ps1 on|off|status`.
Dominio público: `app.marsmode.me`. Runbook completo: `docs/actualizar-produccion.md`.

El contenedor `cron` corre solo desde el arranque: su crontab (`CRON_TZ=America/Lima`)
hace `POST` con `Bearer CRON_SECRET` a `http://web:3111/api/cron/*`. 6 jobs:

| Cron | Frecuencia | Qué hace |
|---|---|---|
| `recordatorios` | Cada hora | Recordatorio 24h antes de citas confirmadas + reintentos de fallidos. |
| `renovaciones` | Cada hora | Ciclo de suscripción: activo → por_renovar (≤3 días) → aviso el día de vencimiento → 7 días de gracia → suspendido. |
| `fiscal` | Cada hora | Reemisión de comprobantes `pendiente_envio` (≤7d) y `rechazados` (≤48h) vía lycet/SUNAT. |
| `diario` | Diario 08:00 (Lima) | Digest al owner: caja, stock bajo, laboratorio, pendientes. |
| `recall` | Diario | Recall automático de pacientes dormidos ≥6 meses (dedupe 60 días). |
| `seguimiento` | Diario | Seguimiento de presupuestos enviados hace ≥3 días (1er aviso) y ≥7 (final) + cuotas vencidas. |

En desarrollo local (Windows) los mismos endpoints se agendan con
`scripts/instalar-cron.ps1` (**dev-only**). Detalle en `docs/01-topologia.md`.

## Variables de entorno

| Variable | Requerida | Qué rompe si falta |
|---|---|---|
| `DATABASE_URL` | Sí | Arranque completo (conexión a Postgres). |
| `NEXT_PUBLIC_APP_URL` | Sí | Links en emails/citas apuntan a dominio incorrecto. |
| `RESEND_API_KEY` | Opcional | Envío de emails (recordatorios, confirmaciones, recalls, campañas) falla con `email_no_configurado`. |
| `RESEND_FROM` | Opcional | Remitente de emails; mismo fallo que sin `RESEND_API_KEY`. |
| `CRON_SECRET` | Opcional | Cron job (`/api/cron/*`) rechaza peticiones por autenticación. |
| `ADMIN_EMAILS` | Deprecated (bootstrap) | Ya no gobierna el acceso a `/admin`. El acceso es por cuenta: `users.is_platform_admin` + sesión de plataforma (sin membership). Se conserva solo como bootstrap inicial del fundador; se ignora en runtime. |
| `FOUNDER_EMAIL` / `FOUNDER_PASSWORD` | Opcional | Crear/actualizar la cuenta fundador (`is_platform_admin`) sin pasar por el seed dev: `npm run db:seed:founder`. En el primer login fuerza el cambio de contraseña en `/primer-acceso`. |
| `LOCAL_MASTER_KEY` | Opcional | Cifrado at-rest de certificados/Clave SOL y tokens WhatsApp; sin ella la emisión electrónica no puede guardar credenciales. |
| `LYCET_URL` | Opcional | Emisión electrónica a SUNAT vía sidecar lycet (default `http://localhost:8090`); modo `manual` funciona sin él. |
| `WHATSAPP_VERIFY_TOKEN` | Opcional | Verificación del webhook de WhatsApp (Meta); el token y phone id se configuran desde consola y se cifran en DB. |
| `ATTACHMENTS_DIR` | Opcional | Directorio de adjuntos; default `.data/attachments`. |

## Credenciales demo

Seed crea 5 usuarios (password: `demo1234`, dominio `@demo.odontoflow.pe`):

| Email | Rol |
|---|---|
| `owner@demo.odontoflow.pe` | owner |
| `recepcion@demo.odontoflow.pe` | receptionist |
| `luis@demo.odontoflow.pe` | doctor |
| `maria@demo.odontoflow.pe` | doctor |
| `asistente@demo.odontoflow.pe` | assistant |

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Web en desarrollo (`next dev`). |
| `npm run build` | Build de todos los workspaces. |
| `npm run typecheck` | `tsc --noEmit` en todos los workspaces. |
| `npm run lint` | ESLint (apps/web) + lint por workspace. |
| `npm test` | Tests del core (`node --test` + tsx en packages/core). |
| `npm run db:generate` | Genera migraciones Drizzle desde el schema. |
| `npm run db:migrate` | Aplica migraciones. |
| `npm run db:seed` | Seed con datos demo. |
| `npm run of:up` / `of:down` / `of:status` / `of:db` | Docker Compose (WSL2): subir/bajar/estado/psql. |
| `instalar-cron` | **DEV-ONLY (Windows)**: tareas programadas `OfCron`/`OfCronDiario` → `localhost:3111/api/cron/*` (requiere `CRON_SECRET`). En producción lo reemplaza el contenedor `cron` (supercronic) de `docker-compose.prod.yml`. |
| `scripts/backup.ps1` | `pg_dump` vía WSL/docker → `backups/*.dump` (retención 30 días). |
| `scripts/marsmode.ps1 on\|off\|status` | Prender/apagar el servidor prod (WSL + Docker + túnel) y liberar RAM. |
| `scripts/e2e-funcional.js` | Suite E2E funcional canónica (16 pasos) contra la app desplegada: `npm run e2e:funcional`. |
| `GET /api/health` | Health check: `SELECT 1` con timeout 3s → 200 ok / 503. |

## Reglas

1. Multi-tenant: `tenant_id` en toda query y validación server-side. RBAC server-side (SSOT `packages/core`).
2. Cada clínica emite comprobantes con SU RUC/certificado/Clave SOL (nunca el nuestro).
3. Privacidad del paciente: whitelist estricta; el paciente nunca ve listas ni ocupación real.
4. Cobro de suscripciones es manual (Yape/Plin) vía panel admin; sin pasarela todavía.
5. Feature nueva sin change aprobado en `openspec/changes/` no entra al código (`docs/12-sdd-openspec.md`).
6. Commits en español sin acentos, cuerpo detallado; sin mojibake en código user-facing (escáner en CI).
