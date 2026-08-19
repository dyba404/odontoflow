# odontoflow — Resumen ejecutivo

SaaS de gestión para consultorios odontológicos en Perú (mercado MYPE masivo).

## Qué es
Reservas online (modelo solicitud→confirmación), agenda multirol, ficha clínica con
odontograma FDI, caja con Yape/Plin/efectivo, recordatorios y dashboard de ganancias.
Correcciones auditadas de punta a punta: citas reversibles (deshacer check-in/llamado,
paciente que llegó tarde), anulación contable de pagos, reapertura de cierre diario,
retrocesos de laboratorio y baja SUNAT real (RA boleta + nota de crédito factura).
Recordatorios WhatsApp por plantillas Meta con fallback automático a email.

## Decisiones clave (acordado con el dueño del proyecto)

| Tema | Decisión |
|---|---|
| Nicho MVP | Solo odontología (extensible después) |
| Nicho secundario (elegible) | Fiscal/contable MYPE, restaurantes/POS — pausados |
| Reserva del paciente | Híbrido configurable: por defecto solicitud→confirmación; opción de slots instantáneos ofertados por clínica |
| Preferencia de doctor | El paciente indica preferencia SIN ver agendas ni presencia |
| Privacidad del paciente | Whitelist estricta: nunca ve lista de pacientes, presencia del doctor, ocupación real ni sala de espera |
| Cobro de suscripciones (a nosotros) | MANUAL concierge: Yape/Plin/transferencia directa; panel admin con planes/vencimientos/recordatorios; gating por flags. Culqi solo cuando el manejo manual sature (~50 clientes) |
| Caja de la clínica | Registro manual Yape/Plin/efectivo/POS + cuadre de cierre. Cuotéalo/cuotas: backlog |
| Facturación electrónica | Greenter self-host (sidecar `lycet`, MIT, PHP/Docker) como microservicio; cada tenant emite con SU RUC, SU certificado digital y SU Clave SOL. Nunca nuestro RUC |
| Roles | owner · receptionist (PC) · assistant (celular) · doctor (celular) · patient (público) |
| Asistente | Solo datos + estados + adjuntos Rx; NUNCA caja ni precios |
| Seguridad | RBAC server-side (tenant_id + role), horarios de turno con restricción opcional de acceso fuera de turno, audit log, escalable a SSO (BoxyHQ Jackson) |
| Panel de operador | Cuenta fundador (`is_platform_admin`, sesión plataforma sin membership) con panel `/admin` auditado: reenvío de recuperación, bloqueo/desbloqueo de usuarios y membresías, impersonación por token de 1 uso. Todo registrado en `audit_logs` con `via: "soporte_plataforma"`; sin SQL manual |
| UI | Design system propio (paleta teal clínico + neutros cálidos, español día 1, densidad por dispositivo). La UI de BoxyHQ se descarta; solo se usa su motor headless |
| WhatsApp | Fase M4: solo Cloud API oficial, plantillas de utilidad como add-on cobrado (margen 2-3x). Core: email/SMS |
| Hosting | Dominio propio (no GitHub Pages; sin huella del perfil personal). App en Heroku (crédito Student Pack US$13/mes ×24m, dominio custom). Landing en Netlify/Vercel free. Repos privados |
| Migración de infra | Solo cuando haya MRR (mes 25 o antes si Heroku crédito acaba): VPS barato o railway |
| Stack | TypeScript/Node monorepo (npm workspaces), Next.js, Postgres, shadcn/ui + Tailwind |
| Ruta local | `~/Documents/projects/odontoflow` |

## Modelo de ingreso (nosotros)
- Plan Free (S/0): reservas + agenda + sala de espera → gancho de adquisición
- Plan Pro (S/79): ficha clínica + recordatorios email/WhatsApp
- Plan Premium (S/149): caja, facturación electrónica SUNAT, dashboard/márgenes, inventario, presupuestos y comisiones
- Gating real por plan (server-side en `apps/web/src/lib/plans.ts`); módulos premium devuelven 402 `plan_insuficiente` y la UI muestra renovación por Yape
- Add-ons futuros: WhatsApp (por plantilla), revendedor NubeFacT si se evalúa

## KPIs objetivo
- Conversión demo→pago ≥ 40%
- Churn mensual < 5%
- ≥ 1 no-show recuperado/mes por tenant
- 10-30 clientes pagantes al cierre de M5

## Estado
Sistema maduro listo para M5. Roadmap completo y backlog post-M5 implementado. Ver `02-roadmap.md`.
Máquinas de estado y protocolos de deshacer/corrección: `06-estados-protocolos.md`.
