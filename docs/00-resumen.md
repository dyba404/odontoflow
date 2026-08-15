# odontoflow — Resumen ejecutivo

SaaS de gestión para consultorios odontológicos en Perú (mercado MYPE masivo).

## Qué es
Reservas online (modelo solicitud→confirmación), agenda multirol, ficha clínica con
odontograma FDI, caja con Yape/Plin/efectivo, recordatorios y dashboard de ganancias.

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
| UI | Design system propio (paleta teal clínico + neutros cálidos, español día 1, densidad por dispositivo). La UI de BoxyHQ se descarta; solo se usa su motor headless |
| WhatsApp | Fase M4: solo Cloud API oficial, plantillas de utilidad como add-on cobrado (margen 2-3x). Core: email/SMS |
| Hosting | Dominio propio (no GitHub Pages; sin huella del perfil personal). App en Heroku (crédito Student Pack US$13/mes ×24m, dominio custom). Landing en Netlify/Vercel free. Repos privados |
| Migración de infra | Solo cuando haya MRR (mes 25 o antes si Heroku crédito acaba): VPS barato o railway |
| Stack | TypeScript/Node monorepo (npm workspaces), Next.js, Postgres, shadcn/ui + Tailwind |
| Ruta local | `~/Documents/projects/odontoflow` |

## Modelo de ingreso (nosotros)
- Plan Free (S/0): reservas + agenda → gancho de adquisición
- Plan Pro (S/79): ficha + recordatorios email/SMS ilimitados
- Plan Premium (S/149): caja + dashboard ganancias + paquetes de recordatorios
- Add-ons futuros: WhatsApp (por plantilla), facturación electrónica (Greenter sidecar), revendedor NubeFacT si se evalúa

## KPIs objetivo
- Conversión demo→pago ≥ 40%
- Churn mensual < 5%
- ≥ 1 no-show recuperado/mes por tenant
- 10-30 clientes pagantes al cierre de M5

## Estado
M0 en ejecución. Ver `02-roadmap.md`.
