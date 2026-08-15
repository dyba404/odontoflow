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
   Postgres            Worker (cron)   Notificaciones   Pagos suscripción   Facturación (futuro)
   (Heroku Postgres)   recordatorios   email/SMS        MANUAL (Yape/Plin)  sidecar lycet (Greenter)
                                       (Resend free)    panel admin flags   Docker, API REST
```

## Decisiones

- **GitHub Pages: DESCARTADO** (URL `usuario.github.io` visible, atado al perfil personal, solo estático).
  GitHub queda SOLO como repositorio privado del código (GitHub Pro del Student Pack) y portafolio personal.
- **Heroku** cubre app + Postgres con el crédito US$13/mes × 24 meses del Student Pack.
  Dominio custom con SSL (CNAME) sin exponer `herokuapp.com` al usuario final.
- **Landing estática** en Netlify o Vercel free tier con dominio custom (o Appwrite Pro del pack).
- **Monolito Next.js** (apps/web): páginas + API routes. Nada de microservicios hasta que duelan.
- **Sidecar Greenter (fase futura)**: `giansalex/lycet` (MIT, Symfony+Docker) como segundo proceso;
  Node lo llama vía `POST /documents`.
- **WhatsApp Cloud API (M4)**: integración oficial, webhook entrante. Cuentas Business por tenant.

## Entorno local de desarrollo (real, implementado 2026-08-15)

```
Windows 11 24H2
├── node / npm / git / código  → C:\Users\Administrator\Documents\projects\odontoflow
└── WSL2: Ubuntu 26.04 LTS (usuario: dev)
    ├── systemd habilitado
    ├── Docker Engine 29.7 + compose plugin 5.4 (repo oficial, target "noble" compat)
    └── postgres:16 (container odontoflow-db, volumen pgdata)
             ↑ expuesto en localhost:5432 (WSL2 forwarding automático)
```

- Código en Windows; los contenedores solo corren servicios (nada montado desde Windows en los contenedores, salvo el compose file vía `/mnt/c`).
- `.references/` (gitignored): referencias clonadas — boxyhq/saas-starter-kit (tenancy headless), giansalex/lycet, thegreenter/greenter, clawnify/open-salon, satnaing/shadcn-admin.
- Levantar/parar: `wsl.exe -d Ubuntu -u dev -- sudo docker compose -f /mnt/c/Users/Administrator/Documents/projects/odontoflow/docker-compose.yml up -d` / `wsl.exe --shutdown` (libera RAM y detiene contenedores; reanudan con `docker compose up -d`).
- Conexión desde Windows: `postgres://odontoflow:odontoflow_dev@localhost:5432/odontoflow` (.env.local.example).

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
└── (futura) apps/lycet/ → sidecar facturación (Docker)
```

## Plan de infra a futuro

- Mes 0–24: Heroku crédito + free tiers = costo US$0.
- Con MRR: migrar a VPS (Hetzner ~US$5-10) o Railway; luego `.pe` si el negocio despega.
- La migración SOLO ocurre cuando haya clientes pagando (nunca antes).
