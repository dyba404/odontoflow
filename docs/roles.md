# Roles, permisos y diseño por superficie

## Actores y dispositivos

| Rol | Dispositivo | Qué hace | Vista |
|---|---|---|---|
| owner (Dueño) | PC + celular | Caja, reportes, config, personal, plan | Consola completa PC-first + dashboard móvil |
| receptionist (Recepcionista) | PC | Agenda citas, check-in, cobra, recordatorios, cuadra caja | Calendario denso + cola espera + caja (alta densidad) |
| assistant (Asistente) | Celular | Toma datos, prepara paciente, notas/observaciones, adjuntos | Móvil: ficha rápida + botones de estado grandes |
| doctor (Odontólogo) | Celular/tablet | SU agenda, lee ficha, notas clínicas, marca atendido | Móvil limpio: agenda→paciente actual→ficha/notas |
| patient (Paciente) | Celular | Reserva, reprograma, cancela | Página pública reservas, sin cuenta, link mágico |

## Matriz de permisos

| Acción | Dueño | Recepción | Asistente | Doctor |
|---|---|---|---|---|
| Ver agenda completa | ✅ | ✅ | ✅ (solo estados) | Solo la suya |
| Crear/editar/cancelar citas | ✅ | ✅ | ❌ | Solo propias |
| Check-in / sala de espera | ✅ | ✅ | ✅ | ❌ |
| Crear/editar datos paciente | ✅ | ✅ | ✅ | ✅ |
| Ver/editar ficha clínica | ✅ | Solo contacto | Parcial (Rx, alergias) | ✅ |
| Registrar pagos / caja | ✅ | ✅ | ❌ | ❌ |
| Ver ingresos/reportes | ✅ todo | Solo cierre diario | ❌ | Opcional (flag dueño) |
| Enviar recordatorios | ✅ | ✅ | ❌ | ❌ |
| Gestionar personal/horarios | ✅ | ❌ | ❌ | ❌ |
| Configurar servicios/precios | ✅ | ❌ | ❌ | ❌ |
| Emitir comprobantes | ✅ | ✅ | ❌ | ❌ |

Por defecto: asistente = datos + estados, SIN caja. (En clínicas pequeñas el dueño puede elevarlo a recepcionista.)

## Horario laboral / turno
- Cada miembro: `staff_schedules` (día_semana, hora_ini, hora_fin).
- Flag por tenant `restringir_fuera_horario`: si activo, fuera del turno no puede iniciar sesión.
- Registrar actividad por turno (audit).

## Privacidad del paciente (whitelist estricta)

El paciente SÍ ve: logo/nombre clínica, catálogo servicios+precios, horarios generales,
su solicitud de cita y su confirmación, su link mágico.

El paciente NO ve: lista de otros pacientes, horario real/calendario del doctor,
presencia del doctor (si está hoy o no), ocupación real, doctor asignado hasta confirmar,
notas internas, sala de espera.

→ El tablero sala de espera es SOLO interno (recepción/asistente/doctor).

## Flujo de reserva (modelo solicitud→confirmación, por defecto)

1. Paciente entra a r.<dominio>/<clinica>
2. Wizard 3 pasos: servicio → fecha/franja (mañana/tarde) + preferencia de doctor (sin agenda) → datos + consentimiento
3. Envía solicitud (estado `solicitada`)
4. Recepción la ve en cola "Solicitudes", aprueba/ajusta, asigna doctor+hora exacta → estado `confirmada`
5. Paciente recibe confirmación (email/SMS) con hora exacta + link mágico

Modo alternativo: `booking_mode = instantaneo` (la clínica oferta slots públicos limitados;
aun así sin ver lista de otros pacientes).

## Workflow canónico de una cita

1. Recepcionista crea/confirmada la cita (slots sugeridos)
2. Recordatorio automático día anterior (email/SMS; WhatsApp add-on)
3. Paciente llega → recepción hace check-in → "sala de espera"
4. Asistente lo llama, registra datos, alergias, adjunta Rx
5. Doctor ve "mi siguiente", lee ficha, atiende, escribe nota clínica + tratamiento + próxima cita sugerida
6. Doctor marca "atendido" → vuelve a recepción
7. Recepción cobra (Yape/Plin/efectivo) + agenda próxima → cierre
8. Dueño ve en dashboard: citas día, ingresos, no-shows

## Diseño UI (anti-genérico)

- Paleta: teal clínico (#0F766E primario) + neutros cálidos. NO gris frío típico.
- Estados cita: pendiente ámbar · confirmada azul · en-espera violeta · atendida verde · no-show rojo
- Tipografía Inter/Geist; tabular-nums para montos/horas
- Densidad adaptativa: recepción PC densa; doctor/asistente móvil cards + botones ≥48px
- Español desde día 1 ("Caja", "Sala de espera", "Agenda del día")
- Componentes: shadcn/ui + Tailwind + Radix (MIT)
- Referencia visual (NO copiar UI BoxyHQ): satnaing/shadcn-admin, Kiranism/next-shadcn-dashboard-starter
- Empty states con CTA; optimistic UI + toasts; command palette (Ctrl+K)

## Superficies (estructura de rutas en apps/web)

```
/public/[clinica]/reserva     → página pública paciente (sin auth)
/consola/(por rol)            → app.<dominio>
   /consola                   → dashboard según rol
   /consola/agenda            → recepción/doctor
   /consola/sala-espera       → recepción/asistente (tiempo real)
   /consola/pacientes         → todos (según permisos)
   /consola/caja              → recepción/dueño
   /consola/dashboard         → dueño (ganancias)
   /consola/personal          → dueño
   /consola/solicitudes       → recepción (cola de solicitudes)
/admin                        → operador del SaaS (nosotros)
```
