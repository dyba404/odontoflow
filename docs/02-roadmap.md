# Roadmap

Regla: feature freeze tras M3. Solo ship → vender → medir antes de construir más.

## M0 — Fundaciones (semana 1)
- [x] Persistir plan en docs/
- [x] Monorepo npm workspaces: apps/web + packages/{ui,core,db}
- [x] Design system base (tokens teal, tailwind config)
- [x] Core: dominio (roles, permisos, estados de cita, enums)
- [x] Web: esqueleto Next.js con layouts por rol
- [x] DB: schema multi-tenant (tenant_id en todo)
- [x] Integrar BoxyHQ saas-starter-kit como motor headless (tenants/memberships/roles/invitaciones)
- [x] Deploy Heroku + Postgres + dominio custom (SSL)
- [x] Landing estática (Netlify/Vercel)
- [x] CI/CD + lint/typecheck (lint ESLint + tests node:test en packages/core)

**Salida:** app.<dominio> viva, demo end-to-end grabable.

## M1 — Reservas públicas (semana 2-4)
- [x] Página pública r.<dominio>/<clinica>: wizard 3 pasos (servicio → fecha/franja + doctor preferencia → datos + consentimiento)
- [x] Motor de slots (disponibilidad, buffers, franjas) — core
- [x] Estados: solicitada → pendiente de confirmación
- [x] Link mágico del paciente (reprogramar/cancelar, sin cuenta)
- [x] Cola de "Solicitudes de cita" para recepción (aprobar/asignar doctor+hora exacta)
- [x] Confirmación por email/SMS con hora exacta

**Salida:** demo end-to-end reservando.

## M2 — Consola multirol + clínica (semana 5-8)
- [x] RBAC server-side: owner/receptionist/assistant/doctor
- [x] Vistas por rol y dispositivo: recepción (PC densa), doctor/asistente (móvil cards)
- [x] Ficha clínica: datos, antecedentes, alergias, intake médico
- [x] Odontograma FDI interactivo (estados por diente)
- [x] Adjuntos Rx desde celular (asistente)
- [x] Tablero sala de espera en tiempo real (check-in → móvil de doctor/asistente)
- [x] Reversibilidad/deshacer en citas (confirmada→solicitada, deshacer check-in/llamado, no_show→confirmada) con toast "Deshacer" 5s en sala de espera
- [x] Drag & drop en agenda día (reprogramar hora/arrastrar entre doctores, solo solicitada/confirmada)
- [x] Consentimientos firmados en pantalla (canvas → PDF)
- [x] Dedupe pacientes (celular/DNI/nombre)
- [x] Schedules de turno + restricción opcional fuera de horario
- [x] Audit log

**Salida:** 3 clínicas piloto usándolo a diario.

## M3 — Caja + cobros + dashboard (semana 9-10)
- [x] Caja: registro manual Yape/Plin/efectivo/tarjeta POS
- [x] Cierre diario + conciliación (contado vs referenciado vs POS)
- [x] Anulación contable de pagos (motivo ≥3, comisiones→0, cuotas→pendiente, exclusión de totales)
- [x] Reapertura de cierre diario (solo owner, motivo) + cierre nuevo tras corrección
- [x] Dashboard de ganancias del dueño (por doctor/servicio/método, no-shows, ocupación)
- [x] Registro manual de comprobantes (nº boleta, correlativo) + vat_settings modo manual
- [x] Planes manuales: panel admin activa flags + vencimientos + recordatorios de renovación
- [x] **Primer pago real (Yape/Plin directo a nosotros)** — manual concierge

**Salida:** MRR.

## M4 — Recall + WhatsApp (semana 11-12)
- [x] Sistema de recall: pacientes dormidos (>6 meses) → recordatorio
- [x] Recordatorios automáticos 24h antes (email/WhatsApp plantilla; fallback email si WhatsApp falla)
- [x] WhatsApp Cloud API add-on: plantillas utilidad (Meta `type:"template"`, fuera de ventana 24h) con fallback automático a email — requiere credenciales Meta
- [x] Notificación al paciente al reprogramar (email/WhatsApp, plantilla reprogramacion)
- [x] Retry de recordatorios fallidos (reenvío manual recall/recordatorio_24h desde consola)

**Salida:** margen ≥2x costo de plantilla.

## M5 — Lanzamiento (semana 13+)
- [ ] 30 consultorios objetivo: TikTok/IG casos de éxito + QR WhatsApp inbound
- [ ] Alianzas colegios profesionales

**Salida:** 10-30 clientes pagantes.

---

## v1.1.0 — Post-QA: observabilidad, portal paciente, fiscal avanzado, WhatsApp económico

- [x] Observabilidad de email en dev: servicio Mailpit (solo docker-compose.yml dev, :1025 SMTP / :8025 UI) + `MAIL_MODE=resend|smtp-dev` en lib/mail.ts. Producción sigue siendo Resend; el compose prod fija `MAIL_MODE=resend`
- [x] Portal paciente passwordless (token por paciente 30 días, sin cuentas): citas/historial, cuotas, comprobantes aceptados con descarga PDF/XML/CDR (ownership receipt→payment→patient), presupuesto, consentimientos, botón confirmar asistencia
- [x] Pago QR Yape/Plin con conciliación semi-automática por referencia (pago `por_conciliar` excluido de caja hasta conciliar; pagina consola "Pagos por conciliar")
- [x] Consentimiento del wizard público persistido en signed_consents (ya no se descartaba)
- [x] WhatsApp mínima huella (`WA_REPLY_MODE=silent|single|full`, default single): 1 mensaje por interacción con link a la web; keywords CONFIRMAR/CANCELAR conservadas; todos los entrantes/salientes a tabla `whatsapp_messages` + bandeja en consola
- [x] Fix webhook_verified_at: solo se estampa en filas con config completa (antes tocaba todas las activas)
- [x] Fiscal: QR SUNAT embebido en el PDF, logo de clínica en el PDF, baja REAL de boletas vía Resumen de Bajas (voided, ticket + consulta de estado), consulta de CDR diferido (`GET /invoice/status`), split aseguradora y edición de coberturas con UI, soporte/health con checks reales
- [x] Punto C: Playwright E2E (`npm run test:e2e`, matriz RBAC 28 rutas × 4 roles + flujo transversal), auditoría con filtros/paginación/export CSV, PWA offline real (offline-store IndexedDB + borrador de nota clínica)
- [x] Seed demo enriquecido e idempotente: aseguradoras/coberturas, inventario con lotes y kardex, laboratorio, presupuestos y cuotas
- [x] Fixes reales detectados por la E2E: `fmtFechaRelativa` crasheaba con fechas ISO (`/consola/inventario` RangeError); `/api/health` ya no da 503 por canales degradados (correo/lycet) — solo por la DB

---

## v1.2.0 — Doble local de WhatsApp + ensayo general en vivo (sin producción externa)

- [x] Fase A: `caja/pagos/[id]/aseguradora` rechaza pagos anulados (409); `cron/fiscal` consulta el CDR antes de reemitir comprobantes rechazados ya enviados (contador `cdrRecuperados`, evita duplicar notas aceptadas sin CDR local); `consultarCdrComprobante` acepta `pendiente_envio`/`rechazado`
- [x] Fase B: whatsmock local — repo `fdarian/whap` en `.references/whap`, servicio `whatsmock` en docker-compose (`:3010`, API Meta-compatible `/v22.0/{phoneNumberId}/messages` + `/mock/simulate-message`), `scripts/setup-whatsmock.ps1` idempotente, `WHATSAPP_BASE_URL` configurable en `lib/whatsapp.ts` (default sigue siendo Graph real)
- [x] Fase B: webhook de WhatsApp en `172.17.48.1:3111` (`WEBHOOK_URL` configurable vía `WHATSAPP_WEBHOOK_URL`; `host.docker.internal` no alcanza al host en WSL-Docker)
- [x] Fase C: `scripts/fiscal-demo.ts` configura el tenant demo para emisión electrónica contra **SUNAT beta real** (RUC 20161515648 / MODDATOS, certificado de pruebas lycet, Clave SOL cifrada con la master key dev) — idempotente
- [x] Fase D: ensayo general verificado en vivo:
  - WhatsApp: entrante simulado → respuesta single con link `localhost:3111/dental/reserva`; keyword REPROGRAMAR → link mágico
  - Portal paciente: resumen/cuotas/presupuestos con token; pago QR genera PNG + ref `ACF525` + pago `por_conciliar`; conciliación staff → cuota pagada; token inválido 404 y ownership en PDFs de terceros 404
  - Fiscal real SUNAT beta: boleta B001-5 emitida y aceptada (hash, XML, CDR), PDF con QR embebido, y baja: boleta → nota de crédito BN01-2 aceptada. Fix raíz: SUNAT rechaza DocumentTypeCode 03 en VoidedDocumentsLine — solo las facturas admiten Comunicación de Baja; boletas van por nota de crédito (código lo tenía invertido). Fix colateral: fechas sin serializar en raw SQL del correlativo voided
  - `NEXT_PUBLIC_APP_URL=http://localhost:3111` en `apps/web/.env.local`: links de correo/WhatsApp/portal ahora apuntan al servidor real de pruebas
- [x] Fase E: E2E Playwright 6/6 verde contra el build final con los cambios anteriores; typecheck limpio; backup real verificado (`scripts/backup.ps1` → `backups/*.dump`, retención 30 días, gitignored)

Salida: todo el stack corre 100% local con dobles de prueba (whatsmock, Mailpit, lycet→SUNAT beta), ensayo end-to-end verificado y sin tocar producción externa.

---

## v1.3.0 — Hardening pre-venta: legal editable, secrets fail-closed, backup prod

- [x] Cumplimiento legal por tenant (Ley 29733): migración 0016 `legal_settings` (razón social, RUC, domicilio, contacto ARCO, textos de privacidad/términos/consentimiento); plantillas legales en `lib/legal.ts` que se rellenan con los datos del responsable — son placeholders editables desde la UI, no textos fijos
  - UI `/consola/config/legal` (solo owner, gate `services.manage` como el resto de config): formulario de responsable + textareas + "Generar textos con mis datos" + vista previa pública + audit `legal.actualizar`
  - API pública `GET /api/clinicas/[clinica]/legal` (solo lectura, cache 5 min) y `GET/PUT /api/config/legal` (valida RUC 11 dígitos, email, máx 10k chars por texto)
  - Páginas públicas `/{clinica}/privacidad` y `/{clinica}/terminos`; el wizard de reserva ahora enlaza ambas desde el checkbox de consentimiento y el portal paciente las muestra en su footer
- [x] Secrets fail-closed: `docker-compose.prod.yml` ya no tiene defaults inseguros (`dev-cron-secret`, `odontoflow_dev`, `123456`, `ADMIN_EMAILS` demo, `NEXT_PUBLIC_APP_URL` localhost) — las variables obligatorias (`POSTGRES_PASSWORD`, `CRON_SECRET`, `LOCAL_MASTER_KEY`, `LYCET_TOKEN`, `NEXT_PUBLIC_APP_URL`) usan `${VAR:?mensaje}` y el `compose up` falla si faltan; los 6 `/api/cron/*` rechazan todo (401) si no hay `CRON_SECRET` configurado; nuevo `.env.prod.example` con generadores y advertencias (una sola `LOCAL_MASTER_KEY` para siempre)
- [x] Backup diario en producción: contenedor `cron` ahora trae `postgresql-client` + `backup-db.sh` (pg_dump -Fc a las 03:40 Lima → `./backups` del host vía volumen, retención 30 días, misma política que `scripts/backup.ps1` dev); entrypoint con su-exec para que el usuario sin privilegios pueda escribir en el bind mount. Verificado con restauración real (scratch DB → conteos correctos → drop)
- [x] Lint 100% limpio (0 warnings): 9 imports/vars sin usar eliminados; los 2 `<img>` restantes (QR data: del portal y fotos detrás de `/api/adjuntos`) llevan eslint-disable justificado: el optimizador next/image no optimiza data URLs ni pasa credenciales a endpoints autenticados
- [x] E2E Playwright 6/6 contra el build final (matriz RBAC ampliada a 29 rutas incluyendo `/consola/config/legal`)

Salida: todo lo internamente resoluble quedó resuelto. Solo resta lo externo: VPS + dominio + HTTPS, Resend con dominio verificado, credenciales/plantillas WhatsApp de Meta, CI remoto.

---

## Backlog post-M5 → incluido en 1.0

Topología detallada por módulo en `docs/05-modulos-topologia.md`.

- [x] Facturación electrónica — sidecar Greenter `lycet` (cada tenant con SU RUC/certificado/Clave SOL)
- [x] Baja SUNAT real: boleta vía Resumen de Bajas (RA, ticket, asíncrono) y factura vía nota de crédito (tipoDoc 07, codMotivo 01)
- [x] Comprobantes manuales editables (serie/correlativo) y anulables
- [x] Inventario odontológico (receta de materiales por servicio, lotes, vencimientos, kardex)
- [x] Lista de espera anti-huecos (cancelación → ofrecer slot a waitlist) + re-encolar si no respondió (ofrecida→activa)
- [x] Reseñas Google post-consulta
- [x] Ciclo completo presupuestos/cuotas: borrador→enviado→aprobado→convertido automático al pagar la última cuota; cuotas pagable/cancelable vinculadas al pago
- [x] Comisiones por doctor (% por procedimiento)
- [x] Campañas de cumpleaños/reactivación
- [x] Inventario → costo real por procedimiento (márgenes)
- [x] Laboratorio/protésico (seguimiento coronas) + retrocesos de un paso con motivo (rev/motivoRevision)
- [x] Fotos antes/después por tratamiento (fotoOrden automático por grupo + ordenamiento en galería)
- [x] EPS/seguros odontológicos (clínicas medianas)
- [x] Multi-sucursal + benchmark interno
- [x] Exportación contable SUNAT / registro de ventas Excel
- [x] Portabilidad/ARCO (Ley 29733) export 1 clic
- [x] Seed demo mejorado (5 usuarios multirol, plan premium, 13 citas en ayer/hoy/mañana, 6 pagos, turnos L-V)
- [x] Modo offline PWA (instalable + fallback sin conexión; cacheo de agenda como mejora futura)
- [x] Infra de producción: `docker-compose.prod.yml` (db + lycet + web standalone :3111) + contenedor `cron` (supercronic, CRON_TZ=America/Lima) que ejecuta los 6 jobs reales (`recordatorios`, `renovaciones`, `fiscal` horarios; `diario`, `recall`, `seguimiento` diarios). `scripts/instalar-cron.ps1` relegado a dev Windows
