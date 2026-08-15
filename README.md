# odontoflow

SaaS de gestión para consultorios odontológicos en Perú (MYPE masivo).

**El plan completo vive en `docs/` — leer ahí antes de decidir nada:**

- `docs/00-resumen.md` — decisiones clave
- `docs/01-topologia.md` — arquitectura y despliegue
- `docs/02-roadmap.md` — Fases M0→M5 + backlog
- `docs/03-roles-diseno.md` — roles, permisos, superficies, privacidad
- `docs/04-modelo-datos.md` — schema multi-tenant

## Estructura

```
apps/web         → Next.js (superficies por rol + API)
packages/ui      → design system (tokens teal clínico)
packages/core    → dominio (roles, permisos, estados)
packages/db      → schema multi-tenant + migraciones
```

## Scripts

```
npm install
npm run dev          # web en http://localhost:3000
npm run build
npm run typecheck
```

## Reglas

1. Multi-tenant: `tenant_id` en toda query y validación server-side.
2. La UI de BoxyHQ NO se usa (solo su motor headless).
3. El paciente nunca ve listas, presencia del doctor ni ocupación real.
4. Cobro de suscripciones es manual (Yape/Plin directo), sin pasarela aún.
5. Cada clínica emite comprobantes con SU RUC/certificado/Clave SOL.
