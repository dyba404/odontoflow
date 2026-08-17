# Capacitación y demo (v1.4.0)

Cómo se capacita a un cliente nuevo y cómo grabar el video demo con la app ya
corriendo en local (o en producción cuando exista).

## Recursos que ya existen en la app

| Recurso | Dónde | Para quién |
|---|---|---|
| **Checklist de primeros pasos** | Panel `/consola` del dueño (aparece solo con setup pendiente y se oculta al completar) | Dueño nuevo |
| **Guía de la app (por rol)** | `/consola/guia` — filtra las guías según los permisos del rol | Todo el equipo |
| **Guía pública (sin login)** | `/{slug}/guia` — para enviar por WhatsApp al equipo sin darles acceso todavía | Equipo completo |
| **Centro de ayuda** | `/consola/soporte` — estado del servicio, contacto y link a la guía | Todos |
| **Páginas legales** | `/{slug}/privacidad` y `/{slug}/terminos` | Pacientes y equipo |

Las guías viven en `apps/web/src/lib/guias.ts` (datos estructurados, fácil de
migrar a Notion/Intercom si algún día se quiere un help center externo) y las
capturas que las ilustran en `apps/web/public/guia/` (se regeneran con
`node apps/web/scripts/captura-guia.mjs` contra el servidor en :3111).

Secciones de la guía:

1. **Primeros pasos** — legal, servicios, invitar equipo, compartir reservas
2. **Citas y sala de espera** — confirmar solicitudes, flujo del día, reprogramar, odontograma
3. **Caja y cobros** — registrar pago, anular, conciliar QR, split aseguradora
4. **Comprobantes SUNAT** — configurar emisión, emitir, dar de baja
5. **Portal del paciente** — portal/pago QR, recall, campañas
6. **Canales** — WhatsApp, reseñas de Google, ARCO

## Onboarding de una clínica nueva (paso a paso real)

1. La clínica se registra en `/signup` → dueño entra a su consola nueva (plan free).
2. El panel muestra el **checklist 0/5**: completar datos legales → crear servicios
   → invitar equipo → compartir la página de reservas → confirmar la primera cita.
3. El dueño envía `/{slug}/guia` (link público) a su equipo por WhatsApp.
4. Primer paciente real: llega solicitud → recepción confirma → cita atendida → pago.
5. Nosotros acompañamos la primera semana vía el correo de soporte (`soporte@odontoflow.pe`).

## Video demo — guion para grabar (OBS)

Configuración: OBS Studio, 1920×1080, captura de ventana del navegador
(Chrome a pantalla completa, zoom 100%), micrófono. Servidor levantado:
`powershell -File scripts/serve-console.ps1` (http://localhost:3111).
Usuario demo: `owner@demo.odontoflow.pe` / `demo1234`.

### Versión ventas (5 min) — 8 escenas

| # | Escena | Qué mostrar | Qué decir (idea) | Duración |
|---|---|---|---|---|
| 1 | Landing | `/` hero + módulos | "Odontoflow: reservas, caja y facturación SUNAT en un solo lugar" | 20s |
| 2 | Reserva pública | `/dental/reserva`: elegir servicio, fecha, datos | "Tu paciente reserva solo, desde su celular, sin descargar nada" | 45s |
| 3 | Confirmación | `/consola/solicitudes` → Confirmar | "Recepción confirma en un clic; el paciente recibe correo con link de gestión" | 40s |
| 4 | El día de la cita | Sala de espera: Llegó → Llamar → Finalizar | "El flujo del consultorio: check-in, atención y cierre" | 45s |
| 5 | Ficha y odontograma | Ficha de paciente + odontograma | "Historia clínica y mapa de dientes, con permisos por rol" | 30s |
| 6 | Caja | Registrar pago + cierre del día | "Yape, Plin, efectivo; el cuadre se hace solo" | 40s |
| 7 | Facturación SUNAT | Comprobantes → emitir boleta → PDF con QR | "Boleta electrónica enviada a SUNAT, con QR; también bajas" | 45s |
| 8 | Cierre | Dashboard + recordatorios | "Y tu dashboard de dueño: ingresos, no-shows y recall automático" | 30s |

### Versión capacitación de equipo (10 min) — por rol

1. **Recepción (4 min)**: solicitudes → confirmar → sala de espera → caja y cierre.
2. **Odontólogo (2 min)**: mi agenda → ficha → nota clínica → odontograma → atender.
3. **Asistente (2 min)**: check-in → datos del paciente → adjuntar Rx.
4. **Dueño (2 min)**: panel/KPIs → invitar equipo → configuraciones (legal, servicios).

Consejos de grabación:

- Graba sobre el seed demo (`npm run db:seed`): ya hay citas hoy, pagos y pacientes.
- Mantén el cursor visible y muévelo despacio; no hagas scroll rápido.
- Si algo falla, repite la toma: el seed es idempotente, puedes re-correlo.
- Sube a YouTube (no listado) o Loom; incrusta el link en `/consola/guia`
  cuando exista (editar `lib/guias.ts`).

## Regenerar capturas de la guía

```powershell
# Servidor ya corriendo en :3111 con datos seed
node apps/web/scripts/captura-guia.mjs
# Las 13 imágenes quedan en apps/web/public/guia/
```
