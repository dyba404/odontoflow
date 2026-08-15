# Roadmap

Regla: feature freeze tras M3. Solo ship → vender → medir antes de construir más.

## M0 — Fundaciones (semana 1)
- [x] Persistir plan en docs/
- [ ] Monorepo npm workspaces: apps/web + packages/{ui,core,db}
- [ ] Design system base (tokens teal, tailwind config)
- [ ] Core: dominio (roles, permisos, estados de cita, enums)
- [ ] Web: esqueleto Next.js con layouts por rol
- [ ] DB: schema multi-tenant (tenant_id en todo)
- [ ] Integrar BoxyHQ saas-starter-kit como motor headless (tenants/memberships/roles/invitaciones)
- [ ] Deploy Heroku + Postgres + dominio custom (SSL)
- [ ] Landing estática (Netlify/Vercel)
- CI/CD + lint/typecheck

**Salida:** app.<dominio> viva, demo end-to-end grabable.

## M1 — Reservas públicas (semana 2-4)
- [ ] Página pública r.<dominio>/<clinica>: wizard 3 pasos (servicio → fecha/franja + doctor preferencia → datos + consentimiento)
- [ ] Motor de slots (disponibilidad, buffers, franjas) — core
- [ ] Estados: solicitada → pendiente de confirmación
- [ ] Link mágico del paciente (reprogramar/cancelar, sin cuenta)
- [ ] Cola de "Solicitudes de cita" para recepción (aprobar/asignar doctor+hora exacta)
- [ ] Confirmación por email/SMS con hora exacta

**Salida:** demo end-to-end reservando.

## M2 — Consola multirol + clínica (semana 5-8)
- [ ] RBAC server-side: owner/receptionist/assistant/doctor
- [ ] Vistas por rol y dispositivo: recepción (PC densa), doctor/asistente (móvil cards)
- [ ] Ficha clínica: datos, antecedentes, alergias, intake médico
- [ ] Odontograma FDI interactivo (estados por diente)
- [ ] Adjuntos Rx desde celular (asistente)
- [ ] Tablero sala de espera en tiempo real (check-in → móvil de doctor/asistente)
- [ ] Consentimientos firmados en pantalla (canvas → PDF)
- [ ] Dedupe pacientes (celular/DNI/nombre)
- [ ] Schedules de turno + restricción opcional fuera de horario
- [ ] Audit log

**Salida:** 3 clínicas piloto usándolo a diario.

## M3 — Caja + cobros + dashboard (semana 9-10)
- [ ] Caja: registro manual Yape/Plin/efectivo/tarjeta POS
- [ ] Cierre diario + conciliación (contado vs referenciado vs POS)
- [ ] Dashboard de ganancias del dueño (por doctor/servicio/método, no-shows, ocupación)
- [ ] Registro manual de comprobantes (nº boleta, correlativo) + vat_settings modo manual
- [ ] Planes manuales: panel admin activa flags + vencimientos + recordatorios de renovación
- [ ] **Primer pago real (Yape/Plin directo a nosotros)**

**Salida:** MRR.

## M4 — Recall + WhatsApp (semana 11-12)
- [ ] Sistema de recall: pacientes dormidos (>6 meses) → recordatorio
- [ ] Recordatorios automáticos 24h antes (email/SMS default)
- [ ] WhatsApp Cloud API add-on: plantillas utilidad cobradas (margen 2-3x)

**Salida:** margen ≥2x costo de plantilla.

## M5 — Lanzamiento (semana 13+)
- [ ] 30 consultorios objetivo: TikTok/IG casos de éxito + QR WhatsApp inbound
- [ ] Alianzas colegios profesionales

**Salida:** 10-30 clientes pagantes.

---

## Backlog post-M5 (ordenado por valor para la clínica)
1. Facturación electrónica — sidecar Greenter `lycet` (cada tenant con SU RUC/certificado/Clave SOL)
2. Inventario odontológico (receta de materiales por servicio, lotes, vencimientos, kardex)
3. Lista de espera anti-huecos (cancelación → ofrecer slot a waitlist)
4. Reseñas Google post-consulta
5. Presupuestos de tratamiento + aprobación + cuotas del paciente
6. Comisiones por doctor (% por procedimiento)
7. Campañas de cumpleaños/reactivación
8. Inventario → costo real por procedimiento (márgenes)
9. Laboratorio/protésico (seguimiento coronas)
10. Fotos antes/después por tratamiento
11. EPS/seguros odontológicos (clínicas medianas)
12. Multi-sucursal + benchmark interno
13. Exportación contable SUNAT / registro de ventas Excel
14. Portabilidad/ARCO (Ley 29733) export 1 clic
15. Modo offline PWA (agenda cacheada)
