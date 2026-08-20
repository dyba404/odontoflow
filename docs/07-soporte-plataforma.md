# Soporte de plataforma (v1.7.0): fundador, acciones de soporte e impersonación auditada

> **Para el agente implementador:** este es el plan completo y autocontenido.
> Todo lo de abajo está verificado contra el código actual (líneas citadas).
> Decisiones del dueño del proyecto ya tomadas: (1) el fundador se crea en el seed
> con contraseña TEMPORAL y la cambia en el primer login; (2) impersonación incluida
> en esta versión; (3) este plan vive solo en `docs/`.

## 1. Problema

El operador del SaaS no tiene identidad propia ni herramientas de soporte:

- `/admin` existe (`apps/web/src/app/admin/page.tsx`) pero el acceso depende de
  `isAdmin()` (`apps/web/src/lib/admin.ts:6`) que compara la sesión contra `ADMIN_EMAILS`
  con fallback HARDCODEADO a `owner@demo.odontoflow.pe` — la dueña de la clínica demo.
  Desplegar sin `ADMIN_EMAILS` haría admin a la demo. Riesgo real.
- No hay cuenta de fundador: `apps/web/src/lib/auth.ts:128` hace `innerJoin(memberships)`,
  y el login (`apps/web/src/app/api/auth/login/route.ts:64-66`) responde `sin_acceso` si el
  usuario no tiene membresía activa. Un usuario sin clínica no puede entrar.
- Si un cliente pierde su contraseña y el email de recuperación no llega, la única vía
  hoy es SQL manual sobre `password_resets`.
- No hay bloqueo de usuarios, ni lista de miembros por tenant para soporte, ni "ver como".

## 2. Patrones externos verificados (de dónde sale el diseño)

Repos leídos vía clon anónimo (READ-ONLY) durante la investigación:

| Fuente | Evidencia | Patrón adoptado |
|---|---|---|
| cal.com | `packages/trpc/server/middlewares/sessionMiddleware.ts:26` (`isAdminMiddleware` → `user.role !== "ADMIN"` lanza 401) | Admin = **flag en la tabla usuarios**, gate server-side puro |
| cal.com | `packages/trpc/server/routers/viewer/admin/_router.ts` (`sendPasswordReset`, `lockUserAccount`, `removeTwoFactor` sin `authedAdminProcedure`) | Acciones de soporte que **reutilizan los flujos self-service** server-side |
| cal.com | `apps/web/modules/shell/banners/useBanners.ts:20` + migración `add_user_impersonation_toggle` | Impersonación con flag de sesión + **banner permanente** |
| dub | `apps/web/app/(ee)/api/admin/impersonate/route.ts` + `lib/auth/admin-impersonation.ts` | Impersonación por **link/token de un solo uso** |
| chatwoot | `app/controllers/super_admin/users_controller.rb` (`resend_confirmation`) | Reenvío de correos de cuenta como acción de soporte |
| boxyhq saas-starter-kit | (verificado en el repo) | NO tiene panel de operador; nada que copiar a ese nivel |

Conclusión: el estándar de facto es flag en DB + acciones que reutilizan flujos
self-service + impersonación auditada con banner. Nada de esto existe en odontoflow todavía.

## 3. Hechos verificados del código actual (para no re-descubrir)

- Migraciones en `packages/db/drizzle/`; la última es `0016_nervous_reavers.sql` →
  la nueva migración será la **0017** (`npm run db:generate` la genera desde el schema Drizzle).
- `sessions` (`packages/db/src/schema.ts:473-491`): `tenantId` y `membershipId` son
  **ambos NOT NULL** con FK. La sesión plataforma necesita que ambos pasen a nullable.
- `password_resets` (schema.ts:498-511) ya tiene `token unique`, `expiresAt`, `usedAt` —
  reutilizable tal cual (aunque `recuperar/[token]/route.ts` quizá no estampe `usedAt`;
  verificar y estamparlo).
- `audit_logs` (schema.ts:455-471): `tenant_id` es **NOT NULL** → todo evento de auditoría
  debe resolverse dentro de un tenant. Todas las acciones de soporte de este plan afectan a
  usuarios que pertenecen a ≥1 tenant (via `memberships`), así que el tenant se resuelve de
  la membresía del objetivo. Los eventos propios del fundador (login plataforma) no se
  auditan en `audit_logs` (no hay tenant); basta access log/stdout.
- `logAudit` (`apps/web/src/lib/audit.ts:6-30`) firma: `{tenantId, usuarioId?, rol?, accion,
  entidad?, entidadId?, payload?}` — `rol` es `StaffRole`, así que para el fundador se pasa
  `rol: null` y el detalle va en `payload: { via: "soporte_plataforma", adminEmail }`.
- **No existe** ruta de cambio de contraseña con contraseña actual (grep confirmó 0 hits).
  El único reset es `/recuperar` vía token. Hay que crear la de "primer login".
- El login form (`apps/web/src/app/(auth)/login/login-form.tsx:31`) hace
  `router.push("/consola")` hardcoded tras login exitoso — hay que adaptar la redirección
  para fundador y para `mustChangePassword`.
- `/consola/layout.tsx` usa `session.teamId` directamente: la sesión impersonada ES la
  sesión del objetivo (teamId real), entonces el layout funciona sin cambios; el banner va en
  `components/console/shell.tsx` (recibe props; montaje limpio sobre `<header>`).
- Email: `enviarEmailPasswordReset({to, nombre, resetUrl})` existe en `apps/web/src/lib/notify.ts`;
  el flujo de token 1h está en `api/auth/recuperar/solicitar/route.ts` (rate limit 5/min).
- `libs`: `randomHex(bytes)` en `lib/audit.ts:47`; rate limiting en `lib/rate-limit.ts`.

## 4. Topología resultante

```
/admin (operador de plataforma)              /consola (tenant)
 ├─ gate: users.is_platform_admin (DB)        ├─ sesión staff normal (sin cambios)
 ├─ sesión plataforma: tenantId=null y        ├─ sesión impersonada: es la sesión del
 │   membershipId=null, válida SOLO si        │   objetivo con impersonated_by_user_id
 │   is_platform_admin (fail-closed)          │   → el layout/rutas ven al objetivo
 ├─ layout con sidebar (v1.9.0):              └─ banner permanente en shell:
 │    · /admin → redirige a /admin/resumen        "Operando como {name} · {clínica} · {admin}"
 │    · /admin/resumen: KPIs + estado de          + botón "Salir" → vuelve a /admin
 │      instancia (db/correo/lycet)
 │    · /admin/tenants: búsqueda + filtros
 │      plan/estado + paginación server-side
 │      → /admin/tenants/[id]: miembros,
 │      plan (nota obligatoria al suspender/
 │      cancelar), auditoría reciente
 │    · /admin/usuarios: búsqueda global
 │      paginada → enlace a la ficha
 │    · /admin/auditoria: feed cross-tenant
 │      de soporte.* con filtro por acción
 │  Acciones por miembro (dialog con motivo):
 │    · Reenviar recuperación (email)
 │    · Bloquear/desbloquear usuario (users.locked_at)
 │    · Desactivar/activar membresía
 │    · Impersonar → token de 1 uso (15 min)
 │    · Suspender membresías en bloque (motivo +
 │      confirmación de impacto en el owner)
 └─ auditoría: audit_logs del tenant del objetivo, payload via:"soporte_plataforma"
```

Reglas de seguridad innegociables:

1. El gate runtime NUNCA decide por env: `ADMIN_EMAILS` deja de leerse en `isAdmin()`.
2. `getSession()` fail-closed: sesión sin membership/tenant válida SOLO si `is_platform_admin`.
3. Tokens de impersonación: 1 uso (`used_at`), TTL 15 min, audit inicio y fin.
4. Sesión impersonada: expira en **8 horas** (no los 30 días normales).
5. Sin auto-impersonación ni entre admins.
6. `users.locked_at` bloquea login Y flujos de recuperación en curso (revisar
   `recuperar/solicitar`: hoy no chequea lock — debe hacerlo).
7. Fundador con `must_change_password=true` no puede entrar a `/admin` ni a ninguna otra
   parte hasta cambiarla.
8. **Admin con membresía (v1.8.1):** si una cuenta `is_platform_admin` llega a
   tener membresía activa en un tenant, el login crea sesión plataforma cuando
   **no** viene `teamSlug` (o no hay membresías) y sesión tenant solo si el
   login llega con `teamSlug`. Así el operador nunca pierde el acceso a
   `/admin` aunque forme parte de un tenant como staff.

## 5. Cambios por capa (checklist del implementador)

### 5.1 Schema + migración 0017 (`packages/db/src/schema.ts`)

- `users`: + `is_platform_admin boolean not null default false`,
  + `locked_at timestamptz null`, + `locked_reason text null`,
  + `must_change_password boolean not null default false`.
- `sessions`: `tenantId` y `membershipId` → nullable (drop notNull);
  + `impersonated_by_user_id uuid null` → `users.id` (onDelete cascade).
- Nueva tabla `impersonation_requests`: `id uuid pk defaultRandom`, `token text not null
  unique`, `target_user_id uuid not null → users`, `tenant_id uuid not null → teams`,
  `requested_by_user_id uuid not null → users`, `expires_at timestamptz not null`,
  `used_at timestamptz null`, `created_at defaultNow`; índice por `token` (unique ya lo da)
  y por `expires_at` para limpieza (opcional: un cron o borrado lazy).
- Generar migración: `npm run db:generate`; aplicar con `npm run db:migrate` en dev
  (WSL docker) — mantener compatibilidad con el seed idempotente.

### 5.2 Auth (`apps/web/src/lib/auth.ts`, `lib/admin.ts`)

- `SessionUser`: + `isPlatformAdmin: boolean`, + `impersonatedByUserId: string | null`.
  `teamId/teamName/teamSlug/teamTimezone/role/membershipId` pasan a `| null` para la sesión
  plataforma (revisar TODOS los consumidores de `SessionUser` — `guardStaff`,
  `consola/layout.tsx`, `console-data`, etc. — el typecheck los señalará).
- `getSession()` (auth.ts:106-158): `innerJoin(memberships)` → `leftJoin`;
  `innerJoin(teams)` → `leftJoin`; si no hay membership: exigir `is_platform_admin`,
  si no, devolver `null`. Rechazar `locked_at != null` (y en ese caso destruir la sesión).
- `createSession()` (auth.ts:69-88): parametrizar `tenantId`/`membershipId` como opcionales,
  + opciones `{ impersonatedByUserId?, maxAgeDays? }` (8h para impersonación). La cookie de
  sesión usa `sessionCookieBase()` (auth.ts:94) — el maxAge de la cookie impersonada debe
  reflejar las 8h.
- `isAdmin()` (admin.ts: entero): leer el flag de la sesión/DB; **eliminar el fallback
  hardcodeado**. Sin lectura de `ADMIN_EMAILS` en runtime.
- `guardStaff()` (auth.ts:168): sin cambios de comportamiento para staff; verificar que
  no reviente con sesión plataforma (debe devolver 401 en rutas de tenant: la sesión
  plataforma no pasa por guardStaff, pero asegurarlo).

### 5.3 Login y primer cambio de contraseña

- `api/auth/login/route.ts`:
  - Si `users.locked_at` → 403 `cuenta_bloqueada` (mesaje neutro).
  - Si `is_platform_admin` y sin membresías activas → `createSession` sin tenant/membership,
    respuesta `{ ok: true, redirect: "/admin" }` (o `redirect: "/primer-acceso"` si
    `must_change_password`).
  - Si `must_change_password` → respuesta `{ ok: true, redirect: "/primer-acceso" }`.
- `login-form.tsx`: respetar `redirect` de la respuesta; sin él, `/consola` como hoy.
- Nueva página `(auth)/primer-acceso/page.tsx` (+ form client): exige contraseña actual +
  nueva (≥8, difiere de la actual), `POST /api/auth/cambiar-contrasena`.
- Nueva `api/auth/cambiar-contrasena/route.ts`: sesión válida, `verifyPassword` de la
  actual, `hashPassword` de la nueva, `must_change_password=false`, destruye las demás
  sesiones del usuario (patrón cal.com), rate limit propio.
- Guard global: while `must_change_password`, cualquier ruta de `/admin` o `/consola`
  redirige a `/primer-acceso` (chequeo en cada layout de grupo: `admin/page.tsx` ya hace
  su guard; `/consola/layout.tsx` también lo gana — una función helper
  `requireSession({ redirectIfMustChange: true })`).

### 5.4 APIs de soporte (`apps/web/src/app/api/admin/…`)

Guard común en helper nuevo `lib/admin-guard.ts`: `getSession()` + `is_platform_admin` +
usuario objetivo resuelto + rate limit `admin:<accion>:<ip>` (20/min). Todas devuelven
JSON estándar `{ok}` / `{error}` con códigos snake_case como el resto del repo.

| Endpoint | Método | Comportamiento |
|---|---|---|
| `tenants/[id]/members` | GET | Miembros del tenant: nombre, email, rol, `memberships.active`, `users.locked_at`, última sesión (máx `sessions.created_at` por user+tenant; desde v1.9.0 vía `DISTINCT ON` server-side: `ultimaSesionPorUsuario` en `lib/console-data.ts`, sin escaneo JS de todas las sesiones) |
| `password-reset` | POST `{userId}` | Réplica server-side de `recuperar/solicitar` (token 1h + `enviarEmailPasswordReset`); si `MAIL_MODE=smtp-dev`/Resend no configurado → error `email_no_configurado`; audit `soporte.recuperacion_enviada` en el tenant del user |
| `users/[id]/lock` | POST `{reason}` | `locked_at=now`, `locked_reason`; borra todas las `sessions` del usuario; audit `soporte.usuario_bloqueado` (en cada tenant del usuario) |
| `users/[id]/unlock` | POST | `locked_at=null`, `locked_reason=null`; audit `soporte.usuario_desbloqueado` |
| `memberships/[id]` | PATCH `{active: boolean, nota?}` | Flip de `memberships.active`; desde v1.9.0 **motivo (`nota`) obligatorio si se desactiva**; audit |
| `memberships/bulk` | POST `{tenantId, active, motivo}` | (v1.9.0) Activa/desactiva en bloque las membresías de un tenant; motivo obligatorio y auditado como `soporte.membresias_desactivadas_bulk` / `..._activadas_bulk` |
| `suscripcion` | PATCH | Cambio de plan/estado/vence/monto/nota; desde v1.9.0 **motivo obligatorio al pasar a `suspendido` o `cancelado`**; audit `soporte.suscripcion_actualizada` |
| `impersonate` | POST `{userId}` | Resuelve el tenant objetivo (primera membresía activa del user; si hay `tenantId` en el body, validarlo). Crea `impersonation_requests` con `randomHex(24)`, TTL 15 min. Respuesta `{ url }`. Audit `soporte.impersonacion_solicitada`. Rechaza admins como objetivo |
| `../impersonar/[token]` | GET | Público pero rate-limited (`impersonar:<ip>`, 10/min). Valida token no usado y no expirado; audiencia: crea la sesión del objetivo con `impersonated_by_user_id` + TTL 8h; guarda el token de la sesión admin actual en cookie `of_admin_return` (httpOnly, maxAge 8h+5min); marca `used_at`; redirect `/consola`; audit `soporte.impersonacion_inicio` en el tenant |
| `auth/end-impersonation` | POST | Sesión actual debe tener `impersonated_by_user_id`; destructiva; restaura sesión admin desde `of_admin_return` (validar que siga viva en DB); borra ambas referencias de cookie; audit `soporte.impersonacion_fin` en el tenant |
| `../impersonar/[token]` expirado/usado | — | Página de error simple (o 410 JSON + algo en UI) |

Notas:
- Los endpoints de usuario (`password-reset`, lock/unlock, `impersonate`) resuelven el
  tenant vía membresías del objetivo (para la auditoría); si el user no tiene ningún
  tenant (otro admin), rechazar.
- `recuperar/solicitar`: agregar chequeo `locked_at` (hoy no lo tiene).
- Limpiar tokens de `password_resets` tras uso: verificar si `recuperar/[token]` ya estampa
  `used_at`; si no, estamparlo + rechazar reuso.

### 5.5 UI

- `/admin/page.tsx`: sin SessionUser → 401/redirect como hoy, pero contra el flag de DB.
  Agregar control expandible por fila de tenant (patrón `Table` + `Dialog` existentes):
  lista de miembros con Badges de estado (Activo/Inactivo/Bloqueado) y los 4 botones de
  acción. Nuevo Server/Client componente sugerido: `admin/members-panel.tsx` +
  `admin/member-actions.tsx` (client, fetch a las APIs, toasts sonner como el resto).
  El `PlanEditor` existente no se toca.
- `components/console/impersonation-banner.tsx` (client o server, el shell es server;
  pasar prop desde `consola/layout.tsx` que ya tiene `getSession()`): barra sticky bajo el
  header, color distintivo (amber), texto `Operando como {name} · {teamName} — vía {adminEmail}`,
  botón "Salir". llames `POST /api/auth/end-impersonation` yredirect `/admin`.
- Montaje en `components/console/shell.tsx` entre header y main (o directamente en
  `/consola/layout.tsx` antes de `<ConsoleShell>` — elegir lo que menos invada el shell;
  el shell recibe `children` genéricos).
- `/primer-acceso`: layout `(auth)` existente (misma paleta de login).

### 5.6 Bootstrap del fundador (semilla)

- `packages/db/src/seed.ts`: al final (idempotente como el resto del seed), upsert del
  usuario fundador:
  - email `fundador@odontoflow.pe`, name `Operador Odontoflow`,
  - password TEMPORAL: `CambiarYa2026!` (hashPassword del seed, scrypt ya existe en seed.ts:12),
  - `isPlatformAdmin: true`, `mustChangePassword: true`,
  - SIN membresía a ningún tenant.
  - Log final con las credenciales + advertencia de cambiarlas en el primer login.
- Para producción: `packages/db/src/seed-founder.ts` + script `npm run db:seed:founder`
  que lee `FOUNDER_EMAIL`/`FOUNDER_PASSWORD` del env (o args), mismo upsert con
  `mustChangePassword: true`. Documentar en README (sección Scripts).
- `ADMIN_EMAILS`: deja de gobernar el acceso; mantenerlo en `.env.local.example` solo
  como semilla histórica con una nota.

### 5.7 Auditoría (regla #1 del repo)

Todas las acciones de soporte: `logAudit({ tenantId: <del objetivo>, usuarioId: <fundador>,
rol: null, accion: "soporte.*", entidad, entidadId, payload: { via: "soporte_plataforma",
adminEmail, ...detalles } })`. Acciones a auditar: recuperación enviada, usuario
bloqueado/desbloqueado, membresía activa/inactiva, impersonación solicitada/inicio/fin.

### 5.8 Docs (batch final del implementador)

- `README.md:36` dice `npm run dev # http://localhost:3000` — la realidad del proyecto es
  **3111** (`scripts/serve-console.ps1:1` param `$Port = 3111`; `NEXT_PUBLIC_APP_URL=
  http://localhost:3111` en apps/web/.env.local; el cron apunta a 3111). Corregir a 3111.
- `README.md` (Variables de entorno): marcar `ADMIN_EMAILS` como deprecated-bootstrap;
  agregar fila `FOUNDER_EMAIL`/`FOUNDER_PASSWORD` (opcional, para `db:seed:founder`).
- `docs/00-resumen.md`: fila nueva "Panel de operador" → flag en DB (patrón cal.com/dub).
- `docs/04-modelo-datos.md`: columnas nuevas de `users`/`sessions` + tabla
  `impersonation_requests`; aclaración BoxyHQ: se re-implementó su MODELO DE DATOS en
  Drizzle (no es un motor integrado ni un fork).
- `docs/01-topologia.md`: `/admin` + sesión plataforma en el mapa de superficies.
- `docs/02-roadmap.md`: esta versión ya registrada como sección v1.7.0.
- `docs/99-sesion-estado.md`: estado de sesión al terminar.

## 6. E2E y verificación

Nueva suite `apps/web/e2e/admin.spec.ts` (config propio `playwright.admin.config.ts`,
serial, proyectos `admin` desktop + `admin-movil` Pixel 7; se excluye de la regresión
vía `testIgnore` en `playwright.config.ts`. Desde v1.9.0: 10 casos × 2 proyectos =
20 tests, navega el panel multi-página y exige motivo en los dialogs):

1. Login del fundador → redirige a `/primer-acceso` (password temporal) → cambiar
   contraseña → ahora sí `/admin` visible.
2. `/admin`: expandir tenant demo → se ven los 5 miembros con estado.
3. Reenviar recuperación a un miembro → el email con el reset link aparece en Mailpit
   (`http://localhost:8025`) → el link del email resetea la contraseña en `/recuperar`.
4. Impersonar al owner demo → la browsa llega a `/consola` con el banner visible →
   "Salir" → vuelve a `/admin` con la sesión del fundador.
5. Bloquear miembro (`users.locked_at`) → su login responde `cuenta_bloqueada`.
6. Token de impersonación vencido/reusado → error, sin sesión.

Verificación final obligatoria (como toda versión del roadmap):
`npm run typecheck` + `npm run lint` (0 warnings) + `npm test` + `npm run build`;
E2E completa contra el build final (desktop + mobile); server standalone reiniciado
(`scripts/serve-console.ps1`) con health 200; `npm run db:clean` post-suites.
Si el seed cambia, re-verificar idempotencia (`npm run db:seed` dos veces seguidas).

## 7. Out of scope explícito

- Pasarela de pago (sigue manual Yape/Plin — docs/00-resumen.md:22).
- Página de estado de salud interna (health panel).
- Multi-fundador (el flag lo permite en el futuro; por ahora 1 cuenta seed).
- Historial global de impersonaciones cross-tenant (vive en `audit_logs` por tenant).
- Portal de tickets/helpdesk externo.

## 8. Orden sugerido de implementación (por dependencias)

1. Schema + migración 0017 + `db:migrate`.
2. `lib/auth.ts` (SessionUser nullables, getSession platform, createSession extendido) +
   `lib/admin.ts` sin fallback → arreglar los roteos de typecheck que salgan.
3. Login (locked/fundador/mustChange) + `/primer-acceso` + `cambiar-contrasena`.
4. Seed fundador (+ script prod) — verificar login completo.
5. APIs admin (members → password-reset → lock → memberships PATCH → impersonate →
   impersonar/[token] → end-impersonation).
6. UI `/admin` (panel de miembros + acciones) + banner de impersonación en shell.
7. E2E + docs batch + verificaciones finales.
