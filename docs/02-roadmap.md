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
