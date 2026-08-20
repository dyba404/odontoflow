# Odontoflow v2.0.0 — Visión y plan

> Aprobado por el usuario el 2026-08-20. Versión de referencia para todo el
> programa v2.0.0. Fuente: `.opencode/plans/v2-vision.md` + investigación de 8
> repos en `.references/`.

---

## 1. Resumen ejecutivo

v2.0.0 convierte a Odontoflow de "gestor administrativo de clínica dental" a
**plataforma clínica completa con IA**: odontograma clínico profesional,
periodontograma, planes de tratamiento con pipeline, presupuestos firmables,
consentimientos con valor legal, portal del paciente self-service, métricas de
retención y un copiloto agéntico — sobre la infraestructura blindada del
programa de escala (olas 1-3, ver `docs/08-plan-escala.md`).

Tres fuentes alimentan el plan:
1. Programa de escala v1.10-v1.12 + portal P1-P5 + retención S1-S5 (aprobado antes, se hereda).
2. Investigación de 8 repositorios abiertos (resumen en §2).
3. Gaps del mercado peruano: AgendaDr (S/149 ofrece producción por doctor y
   no-show recovery que nosotros no tenemos), Weave/Curve (self-service total
   del portal).

---

## 2. Hallazgos de la investigación (8 repos en `.references/`)

| Repo | Licencia | Veredicto | Qué aporta a v2.0.0 |
|---|---|---|---|
| **dentalpin** | BSL 1.1 (prohíbe SaaS derivado) | **NO copiar código.** Solo patrones conceptuales, re-implementados en TS. | Copilot agéntico (paridad RBAC, redacción PHI, confirmación de writes); presupuesto con link público 2FA + firma + motivos de rechazo; plan de tratamiento con pipeline draft→…→closed(closure_reason); pagos con PaymentAllocation/on_account; consultorios + máquina de estados `scheduled→checked_in→in_treatment→completed`; disponibilidad con plantilla semanal + overrides; snapshot de precios en tratamientos realizados |
| **dentalops** | MIT | **Copiar permitido** (atribución en docs). | Constraint de exclusión GiST sobre `tstzrange` (doble-reserva imposible en DB, no solo en app); motor de disponibilidad compartido navegador/servidor; race-test de contienda (19 de 20 requests → 409); tokens por-propósito con HMAC derivado; manage-link 30d sin cuenta |
| **react-advanced-odontogram** (ZoliQua) | MIT | **Integrar como dependencia npm** (`react-advanced-odontogram`). | Odontograma SVG por superficie (caries ICDAS, restauraciones con materiales, endo AAE, prótesis, ortodoncia); periodontograma 6 sitios (PPD/BOP/CAL, Stage/Grade 2017); export FHIR R4 + PDF/SVG/PNG; FDI/Universal/Palmer; 12 idiomas. Restricciones: client-only (`"use client"` + dynamic ssr:false), 1 instancia/página, themes por CSS vars `--odon-*` |
| **react-odontogram** (biomathcode) | package.json dice MIT pero **sin archivo LICENSE** | No usar como dependencia (riesgo legal sin texto). Solo inspiración para selector ligero | Selección a nivel de diente |
| **medplum** | Apache 2.0 | Referencia de patrones (integrar núcleo = overkill) | Multi-tenancy por fila `projectId` + filtrado explícito; AccessPolicy JSON; storage abstracto local/S3 con URLs presignadas; AuditEvent por operación; Bots server-side |
| **openemr** | GPL-3.0 | **Cero código** (GPL contaminaría el repo). Ideas + feature list | Firma e-sign (hash firma + hash documento + lock); enmiendas auditables (request→accept/reject con historial); tabla de anulación `voids` con motivo/actor (patrón SUNAT); auditoría con checksums; portal del paciente con mensajería, pagos, pedidos; formas clínicas registrables por encuentro. **No tiene odontograma** |
| **danphe-emr** | MIT | Referencia feature-list de EMR hospitalario (fuera de scope dental para v2) | Madurez (50+ hospitales en vivo); 40 módulos; ADT; Farmacia/Laboratorio |
| **mediflow-ai** | MIT | Referencia para recepcionista IA futura (v3.x) | Multi-agente (Recepcionista→Planner→Reviewer); anti-double-booking en voz |
| ~~fasten-onprem~~ | — | Archivado (jul-2026), descartado | — |

**Regla legal dura:** dentalpin (BSL 1.1) y openemr (GPL-3.0) son referencia
conceptual únicamente. Lo tomado es re-implementación propia de **conceptos**
(las ideas no están cubiertas por copyright), con procedencia documentada y
**cero líneas de su código** (auditable en commits). Si algún día se copia UI o
código, solo de dentrepos MIT/Apache (dentalops, react-advanced-odontogram,
medplum), con atribución.

### 2.1 Absorción de dentalpin (concepto → re-implementación TS)

**Clínico:**
1. Modelo odontograma: `ToothRecord` estado-actual + `Treatment` superpuesto
   (planned/performed, con precio/duración/IVA **congelados** al snapshot) +
   history append-only + **timeline slider** (viajar en el tiempo por la boca)
   + undo + modos Diagnóstico/Historia.
2. Periodontograma como snapshots inmutables por fecha (su ADR 0013).
3. Plan: numeración secuencial PLAN-YYYY-NNNN, pipeline
   draft→pending→active→completed→archived/closed con `closure_reason`
   (rechazado_paciente|expirado|cancelado_clinica|abandono_paciente|otro),
   presupuesto 1:1, ítem único por treatment, sesiones multi-sesión con
   snapshot de catálogo inmutables tras completar.

**Financiero:**
4. Presupuesto v2: versionado con cadena de padres (reenviar clona v+1),
   link público con verificación 2FA-like (últimos 4 del teléfono/fecha nac.),
   bloqueo tras 10 intentos fallidos, `BudgetAccessLog` con **IP hasheada**
   (nunca IP cruda — privacidad), recordatorios automáticos 7/14 días,
   firma digital registrada (método click/dibujo, hash SHA-256 del documento,
   IP, user-agent, rol firmante paciente/tutor), rechazo con motivo en lista
   cerrada (precio/tiempo/segunda_opinión/otro).
5. Facturación: series numeradas, **número asignado al emitir no al crear**,
   estado `partial`, nota de crédito (`credit_note_for_id`), cadena de hashes
   `document_hash`/`previous_hash`, pagos↔facturas N:M, `compliance_data`
   JSONB por país (para SUNAT CDR metadata).
6. Pagos: `payment_allocations` (adelanto→presupuesto o `on_account`
   reasignable), `refunds` con motivos cerrados, ledger `patient_earned`
   alimentado por eventos (sin acoplar dominios).

**Agenda:**
7. Consultorios (color, orden) + máquina de estados canónica
   scheduled→confirmed→checked_in→in_treatment→completed/cancelled/no_show con
   `current_status_since` ("esperando 12 min") + eventos append-only por
   transición/asignación de box + API kanban por día + índice único parcial de
   slot + semántica wall-clock con TZ de la clínica.
8. Disponibilidad: plantillas semanales + overrides por rango de fechas,
   por clínica Y por profesional.

**Plataforma:**
9. Event bus ligero con handlers transaccionales (la excepción del handler
   revierte la transacción emisora) para integraciones cross-cutting.
10. RBAC formal: permisos `modulo.recurso.accion` con wildcards, matriz
    declarada por módulo, paridad frontend `can()` + spec E2E de RBAC.
11. Interfaz `TenantResolver` (seam limpio para separación física futura).
12. Disciplina docs: `docs/adr/` + docs técnicos por dominio + catálogo de
    eventos auto-generado.
13. **Copilot agéntico** (build v2.0.0 → ship v2.1): registry de tools por
    dominio que envuelven servicios existentes; chokepoint re-check RBAC al
    ejecutar cada tool; redacción PHI determinista (tabla de símbolos por
    sesión, token estable por valor); writes DESTRUCTIVE suspenden el turno y
    piden confirmación explícita (persistida); presupuesto de tokens/coste por
    tenant con evento al 80%; abstracción de provider (OpenAI/Anthropic/
    Ollama); streaming SSE; drawer Cmd/Ctrl+K; playbooks de un toque
    (briefing diario, preparar visita, llenar huecos, recalls vencidos,
    presupuestos sin responder).
14. **Digest matutino determinista por correo** (sin LLM) → entra en Ola 6
    (esfuerzo bajo, valor diario).
15. `DEMO_MODE` que bloquea acciones destructivas para visitantes.
16. Importador migración desde software legacy (v2.1, onboarding).
17. Recalls con snooze + canal WhatsApp con adaptadores (reforzar
    confirmación/re-agendamiento sobre nuestro WA Cloud API).

### 2.2 Playbook de implementación TS (verificado contra código dentalpin)

Cada concepto fue leído del código fuente. Así se reimplementa en nuestro
stack (Next.js route handlers + postgres-js + Drizzle):

1. **Event bus (~80 líneas, `lib/events.ts`).** dentalpin: `dict[tipo→handlers]`,
   `publish()` inline await; handler con parámetro `db` corre dentro de la
   transacción del publicador y su excepción **propaga y revierte todo**; sin
   `db` → fire-and-log la excepción. Publish sin `db` con handler
   transaccional = error inmediato. **TS:** `subscribe(tipo, handler,
   {transactional})` + `publish(tipo, data, {tx?})` (flag explícito); `tx` es
   el cliente postgres-js de la transacción. Handlers de snapshot **no hacen
   fetch de tablas de otros dominios** (el payload lleva todo).

2. **RBAC v2 (`lib/permissions.ts`).** Strings `modulo.recurso.accion`,
   matching con wildcards (`*`, `module.*` = prefijo con punto), caché por rol
   invalidable, `expand_permissions()` da lista plana al frontend. **TS:**
   constante `PERMISOS` SSOT + `can(role, permiso)` helper server +
   `usePermissions()` client. Un solo lugar de verdad backend y frontend.
   Spec E2E dedicado de paridad por rol.

3. **Máquina de estados de cita (F6).** Verbatim del service de dentalpin:
   ```
   scheduled    → {confirmed, checked_in, cancelled, no_show}
   confirmed    → {checked_in, cancelled, no_show}
   checked_in   → {in_treatment, cancelled}   ← requiere consultorio asignado
   in_treatment → {completed, cancelled}
   terminales: completed, cancelled, no_show (conjunto vacío)
   ```
   Const compartida server+client + **test de paridad** (mismo mapa, CI).
   Errores: `InvalidTransition`, `AlreadyInState`, `ConsultorioRequired`.
   `current_status_since` → "esperando 12 min" en sala de espera (absorbe el
   banner v1.9.0). Eventos append-only por transición.

4. **Semántica wall-clock (`lib/dates.ts`).** Datetimes naive entrantes =
   reloj de pared de la clínica (America/Lima por ahora, campo en tenant para
   futuro); almacenamiento UTC; respuestas serializadas con offset de la
   clínica; frontend usa helpers `parseWallClock`/`clinicNow`, NUNCA
   `new Date(iso).getHours()` (bug móvil real de dentalpin).

5. **Link público 2FA (`budgets/public.ts`).** Orden de rechazo = locked →
   expired → método distinto → rate-limit (5 fallos en ventana rodante de 15
   min) → comparar. Métodos: `phone_last4` (dígitos[-4:], comparación de
   tiempo constante, default si el teléfono tiene ≥4 dígitos), `dob` (ISO),
   `manual_code` (bcrypt hash opcional), `none`. Cada intento se loguea
   (`BudgetAccessLog` con **ip_hash SHA-256**, nunca IP cruda; purga 90d);
   **10 fallos acumulados → bloqueo permanente** (recepción puede
   desbloquear). Cookie HttpOnly con **path acotado al token**; secreto de
   firma de cookie **independiente** del global.

6. **Firma de presupuesto.** Al aceptar: render del PDF firmado + **SHA-256
   del PDF** en `budget_signatures.document_hash` = evidencia anti-tamper.
   Metadatos: método (click/dibujo), IP, user-agent, rol firmante, `signed_at`.
   No hay estado `completed` (dentalpin lo eliminó: cierre financiero =
   factura pagada).

7. **Numeración fiscal (adaptación SUNAT).** En la transacción de emisión:
   `SELECT ... FOR UPDATE` sobre la fila de serie, incremento, formato
   `F001-00001234`; backstop = índice único parcial
   `(serie_id, correlativo) WHERE ambos NOT NULL`. Cadena
   `document_hash`/`previous_hash` = evidencia anti-manipulación ante
   fiscalización.

8. **Puente pago↔factura (F7).** "El dinero asignado a un presupuesto es
   dinero para las facturas de ese presupuesto." 3 entradas únicas, todas
   transaccionales: handler `pago.asignado`, barrido de anticipos al emitir
   (la factura puede nacer pagada), endpoint `POST /facturas/{id}/pagos`.
   Reconcile idempotente (objetivo − actual); orden de lock **presupuesto →
   facturas**; `computePaidSummary` única aritmética de pagado (refunds
   proporcionales). Descuentos siempre por línea con prorrateo del descuento
   global — nunca descuento de cabecera (desincroniza el registro fiscal).

9. **Redacción PHI (`lib/redaction.ts`, v2.1).** `SymbolTable` bidireccional,
   token = `KIND_` + sha1(real).slice(0,6) hex → determinista (mismo valor →
   mismo token: el modelo razona sobre "el mismo paciente"). Diccionario de
   claves (`full_name`, `phone`, `email`, `dni` → NAME/PHONE/EMAIL/DNI;
   `*_id` con valor UUID). Salida → tokenizar; entrada → rehidratar
   (longest-first). Tools con `exposes_free_text: true` excluidas del cloud.
   Gap conocido: nombres nuevos en texto libre no se capturan (aceptado).

10. **Contrato de tool para copilot.** Cada tool envuelve un servicio
    existente (nunca duplicar lógica de negocio), declara `permissions:
    [strings exactos de la ruta]`, categoría conservadora (READ/WRITE/
    DESTRUCTIVE — envíos irreversibles = DESTRUCTIVE + confirmación
    explícita), filtra SIEMPRE por tenant_id, devuelve valores nativos,
    nombra campos PII con las claves del redactor. Chokepoint
    `registry.call()` revalida permisos al ejecutar y pre-filtra las schemas
    que ve el modelo. BudgetGuard: UPDATEs atómicos por tenant (tokens +
    céntimos), evento al 80%, corte al 100%, max_actions_per_minute.

11. **Catálogo de eventos + docs.** Registrar todo evento en
    `lib/events/catalog.ts` (unión TS de payload), script que genera
    `docs/eventos-catalog.md`, changelog en `docs/99-sesion-estado.md`, ADRs
    en `docs/adr/NNNN-titulo.md` cuando la decisión no es obvia.

12. **DEMO_MODE.** Guard sobre acciones destructivas en tenants demo → útil
    para URLs demo de marketing.

**Explícitamente NO absorbemos:** plugins install/uninstall en caliente,
capas frontend por módulo, migraciones por módulo, importadores legacy
españoles, Redis/capacity middleware. Somos monolito de un operador;
modularidad solo a nivel `lib/` + dominio.

---

## 3. Arquitectura v2.0.0

### 3.1 Stack (mínimo deliberado)

- **Next.js 15 / TypeScript / Postgres**: se mantiene. Sin frameworks nuevos.
- **+ dependencia npm**: `react-advanced-odontogram` (MIT, ESM, React 19 ok).
- **+ sharp** (thumbnails, Ola 1).
- **Sin Python/FastAPI.** Sin FHIR server (solo export FHIR R4 desde la
  librería del odontograma, para futuros integradores).

### 3.2 Esquema nuevo (v2.0.0)

- `tooth_records`: `tenant_id, patient_id, tooth_number (FDI), tooth_type,
  general_condition, surfaces JSONB, ortho JSONB, notes, updated_at,
  updated_by` + UNIQUE(tenant_id, patient_id, tooth_number). El JSONB guarda
  el estado por superficie en formato compatible con
  `exportStatus/importStatus` de react-advanced-odontogram (hidrata sin
  transformación).
- `odontogram_history`: append-only (quién/cuándo, antes/después por
  superficie) — auditoría clínica legal.
- `perio_records`: snapshots de periodonto (JSONB 6 sitios por diente +
  staging/grade) por fecha — episodios, no mutable.
- `treatment_plans` v2: `plan_number` (PLAN-YYYY-NNNN), estado
  `draft→pending→active→completed→archived|closed(closure_reason)`,
  `budget_id`, `confirmed_at`, `assigned_doctor_id`.
- `treatment_plan_items` + `sessions`: secuencias, estados, snapshot de
  catálogo.
- `budgets` v2: denegado con motivo cerrado (precio/tiempo/segunda_opinión/
  otro), `accepted_via` (link_publico/clinica/manual), `budget_signatures`
  (hash, IP, UA, signed_at, firmante paciente/tutor), `valid_until`,
  recordatorios automáticos 7/14d, versionado `parent_budget_id`.
- `consents`: consentimientos firmados (hash + firma + IP + UA + PDF + rol) —
  patrón e-sign de openemr, base legal MINSA/Ley 27269 digital.
- `payment_allocations`: el pago es depósito repartible en presupuesto
  (anticipos) u on_account — base para planes de pago de ortodoncia.
- **Constraint de agenda**: GiST exclusion sobre `tstzrange` por
  doctor+rango — verificable en SQL (Ola 4, F6).

Reusado v1.x: `tenants`, `users`, `members`, `patients`, `appointments`,
`quotes` (evolucionan a budgets v2), `payments`, `treatments`,
`whatsapp_messages`, `audit_logs`, `attachments`, `plans`.

### 3.3 Multi-tenancia

Filtrado por fila + `getTenantDb()` (actual). Se añaden constraints únicos
por tenant donde faltan (tenant_id en índices compuestos) en Ola 4. La
separación física por tenant queda como seam (`TenantResolver`, patrón 11)
sin implementarse ahora.

---

## 4. Programa de infra (olas 1-3) → `docs/08-plan-escala.md`

| # | Ola | Contenido clave | Tiempo |
|---|---|---|---|
| 1 | **v1.10 Blindaje** | Backup adjuntos + fiscal off-site; thumbnails sharp; pool DB 10; rate-limit con IP real + webhook; cron envíos en paralelo + timeout 900s; healthchecks.io $0; límites memoria contenedores; tab "Salud infra" en /admin | ~1 semana |
| 2 | **v1.11 Storage** | Interfaz `Storage` (local↔R2), uploads presignados, backfill; $0 hasta poner credenciales | ~3-4 días |
| 3 | **v1.12 Dos máquinas** | VPS EU Hetzner (cuando se compre) + PgBouncer + standby tu PC + segundo connector del túnel + retención/partición audit_logs | cuando se compre |

Triggers para mover de ola: adjuntos >100GB, iowait >20%, p95 >100ms o hito
de clientes.

---

## 5. Plan de features v2.0.0 (olas 4-6)

> Cada feature tiene su "cómo" en §2.2. Nada se copia literalmente de
> dentalpin (BSL): re-implementación de conceptos en nuestro stack.

### Ola 4 — Núcleo clínico v2 "historia clínica real" (~3 semanas)

| # | Feature | Detalle (patrón §2.2) | Esfuerzo |
|---|---|---|---|
| F0 | **Fundamentos: event bus + RBAC v2 + fechas wall-clock** | `lib/events.ts` transaccional (1), `lib/permissions.ts` wildcards + `usePermissions()` (2), `lib/dates.ts` (4). Todo lo demás lo usa | 3-4 días |
| F1 | **Odontograma clínico v2** | react-advanced-odontogram en ficha (`"use client"` + dynamic ssr:false); JSONB = formato `importStatus`; historial append-only; timeline por fecha; FDI; undo | 5-6 días |
| F2 | **Periodontograma** | PerioChart de la misma librería; snapshots inmutables (`perio_records`); CAL/%BOP/stage-grade derivados | 2-3 días |
| F3 | **Planes de tratamiento v2** | Pipeline completo con closure_reason; ítems con secuencia y sesiones; snapshot de precios al añadir; 1:1 con presupuesto; kanban + vista global owner | 4-5 días |
| F4 | **Presupuestos v2 + firma + link público 2FA** | SHA-256 del PDF firmado como evidencia anti-tamper; link con phone_last4/dob/manual_code (5); recordatorios 7/14d; clonado v+1 al reenviar | 5-6 días |
| F5 | **Consentimientos firmados** | Template por tratamiento; firma en tablet/pantalla; hash + IP + UA + timestamp; historial; checklist antes de tratamiento | 3-4 días |
| F6 | **Blindaje agenda** | GiST exclusion + máquina de estados canónica con consultorios, `current_status_since`, eventos por transición + race-test N→1 | 3-4 días |
| F7 | **Pagos: allocations v2** | `payment_allocations` (presupuesto/on_account), invariante Σ==amount, reconcile idempotente, `computePaidSummary` único, reembolsos con motivos (8) | 3-4 días |

### Ola 5 — Portal del paciente completo P1-P5 (~1.5-2 semanas)

| # | Feature | Detalle | Esfuerzo |
|---|---|---|---|
| P1 | Reprogramar/cancelar desde portal | Reusa wizard `gestionar` (v1.9.0) | 1-2 días |
| P2 | Instrucciones pre/post-operatorias | Por servicio, envío WhatsApp al confirmar | 1-2 días |
| P3 | Intake digital pre-cita | Historia clínica desde portal (patrón openemr) | 3-4 días |
| P4 | Mensajería bidireccional | `WA_REPLY_MODE=full` con bandeja y plantillas | 2-3 días |
| P5 | Cuentas familiares/tutor | Vista de representante, selector de paciente | 3-4 días |

### Ola 6 — Retención del dueño S1-S5 (~2 semanas)

| # | Feature | Detalle | Esfuerzo |
|---|---|---|---|
| S1 | No-show recovery | Al marcar no_show → link de re-agendar + métrica de recuperación | 2-3 días |
| S2 | Producción por doctor drill-down | Diario/semanal/mensual, comparativa, ventas, tratamientos, tickets | 3-4 días |
| S3 | Series recurrentes | Ortodoncia multi-fase (citas recurrentes + plan) | 4-5 días |
| S4 | Referidos con tracking | Link compartible, informe de referidos | 2-3 días |
| S5 | Digest matutino | Email determinista diario (sin LLM): agenda, recalls, presupuestos, huecos (14) | 2 días |

### Post-v2.0 (ship v2.1)

| # | Feature |
|---|---|
| C1 | **Copilot agéntico v1** — registry de tools, paridad RBAC, redacción PHI, confirmación de writes, BudgetGuard, SSE + Cmd/Ctrl+K, playbooks (patrones 9-10). Build en v2.0.0, ship en v2.1. 10-14 días |
| C2 | Copilot v2: memoria de sesión + más playbooks (llenar huecos, recalls vencidos) |
| V3.x | Recepcionista IA de WhatsApp 24/7 (mediflow patrón) — add-on ~S/29/mes |

---

## 6. Secuenciación y versiones

```
v1.9.0-candidato (sin tag, sin deploy)
Ola 1 → v1.10 Blindaje      → SHIP: rebuild imagen prod + tag v1.9.0 (un solo ship)
Ola 2 → v1.11 Storage       → SHIP
Ola 3 → v1.12 Dos máquinas  → cuando se compre VPS EU
Ola 4 → Núcleo clínico v2   → build (sin ship)
Ola 5 → Portal P1-P5        → build
Ola 6 → Retención S1-S5     → build
SHIP v2.0.0 ─────────────────→ tag v2.0.0 + rebuild prod
Post  → v2.1 Copilot agéntico, v3.x IA recepcionista
```

Estimado total v2.0.0: **~9 semanas** de trabajo continuo. Ola 3 condicional.

---

## 7. Métricas de éxito (desde el ship de v2.0.0)

- % pacientes que agendan/re-agendan desde portal (meta 30%).
- Tasa de aceptación de presupuestos (meta 45% vs 25-30% típico).
- % de no-shows recuperados (meta 15-20%).
- Tiempo de ingreso por paciente nuevo (~15 min → self-service).
- p95 queries API < 100ms con 100 tenants.
- Costo storage por clínica activa < $0.30.

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Copiar código dentalpin (BSL) | Regla explícita + re-implementación de conceptos; auditoría de commits |
| openemr GPL | No tocar código; solo ideas |
| react-advanced-odontogram client-only | `"use client"` + `next/dynamic ssr:false`; jsPDF lazy |
| 1 instancia por página de la librería | Singleton por ficha; export SVG server-side para PDF/portal |
| react-odontogram sin LICENSE | No usar como dependencia |
| JSONB acoplado al formato de la librería | Guardar formato `importStatus` nativo; conversión controlada si se cambia de librería |
| Costos LLM del copilot | Ship v2.1 + BudgetGuard por tenant desde el día 1 |
| Ola 4 retrasa todo | F0-F3 son camino crítico; F4-F7 paralelizables |

---

## 9. Atribuciones de terceros

- **MIT**: dentalops (patrones de scheduling/aislamiento), react-advanced-odontogram (dependencia npm), danphe-emr y mediflow-ai (referencia conceptual).
- **Apache 2.0**: medplum (patrón consultado).
- **BSL 1.1 / GPL-3.0**: dentalpin y openemr — consultados sin copiar código. Conceptos re-implementados y documentados con procedencia en §2.1/§2.2.

---

## 10. Decisiones cerradas (2026-08-20)

1. v1.9.0 se despacha al terminar la Ola 1 (v1.9.0 + Blindaje, un ship/tag).
2. P1-P5 y S1-S5 entran en el ship de v2.0.0.
3. Copilot: build en v2.0.0, ship en v2.1.
4. Absorción dentalpin: máxima posible, re-implementación verificada contra su código (§2.1 + §2.2), cero código copiado.
5. VPS región EU (Hetzner), compra cuando se decida.
6. Object storage: interfaz Storage lista en v1.11; credenciales cuando haya clientes.
