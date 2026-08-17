# Módulos post-M5 — topología por módulo

Estado a sprint 2026-08-16. Todo lo listado en este documento está **implementado en este
sprint** salvo donde se indica lo contrario. Esquema multi-tenant: toda tabla lleva
`tenant_id` (= teams.id) excepto las que son 1:1 por tenant (PK tenant_id) o viven bajo
un padre con tenant.

Máquinas de estado y protocolos de corrección (deshacer/anular/reabrir/retroceder) con
diagramas y catálogo de errores: `docs/06-estados-protocolos.md`.

Mapa general del sistema:

```
                     ┌────────────────────────────────────────────────────┐
                     │                 apps/web (Next.js 15)              │
                     │   Consola por rol + API routes + reserva pública   │
                     └──────┬───────────┬───────────┬────────────┬────────┘
                            │           │           │            │
               ┌────────────┘           │           │            └─────────────┐
               ▼                        ▼           ▼                          ▼
        ┌─────────────┐          ┌────────────┐  ┌──────────┐          ┌──────────────┐
        │  Postgres   │          │  cron      │  │  Resend  │          │  lycet       │
        │  16         │          │ supercronic│  │  (email) │          │  (Docker)    │
        │  (compose)  │          │ v0.2.49    │  │          │          │  :8090 dev   │
        └─────────────┘          └─────┬──────┘  └──────────┘          └──────┬───────┘
               ▲                       │                                      │
               │                       ▼                                      ▼
               │               6 jobs → POST /api/cron/* (Bearer CRON_SECRET)
               │               recordatorios · renovaciones · fiscal (horarios)
               │               diario · recall · seguimiento (diarios 08:00,
               │               CRON_TZ=America/Lima)                 SUNAT beta / prod
               │                                                     (Greenter via HTTP)
               │
        ┌──────┴────────────────────────────────────────────────┐
        │ Facturación · Inventario · Waitlist · Reseñas Google  │
        │ Presupuestos · Comisiones · Campañas · Costos         │
        │ Laboratorio · Fotos · EPS · Multisucursal             │
        │ Export SUNAT · ARCO 29733 · PWA offline               │
        └───────────────────────────────────────────────────────┘
```

---

## 1. Facturación electrónica (sidecar licet / Greenter)

```
 Usuario (recepción)
   │  POST /api/caja/comprobantes/[id]/emitir
   ▼
 apps/web ──lib/lycet.ts──▶ HTTP ?token=LYCET_TOKEN http://localhost:8090/api/v1/* ──▶ licet (Docker :8090→8000)
   │                                                                        │
   │   ◀── { xml, hash, sunatResponse{ success, cdrZip, cdrResponse.code } }│ Greenter
   │                                                                        ▼
   ▼                                                              SUNAT beta / prod (FE_URL por empresa)
 receipts: sunat_estado manual|pendiente_envio|aceptado|rechazado|baja_pendiente|baja_aceptada|baja_rechazada
           + xml_url / cdr_url (relativos, servidos por /api/fiscal/archivo/...) + correlativos
           + baja_ticket / baja_enviada_at / baja_motivo (Resumen de Bajas)
           + afectado_id → comprobante afectado REAL en notas (ya no hardcodeado)
 vat_settings: ruc/razón social/usuario_sol/ambiente(beta|prod)/series/correlativos/emision
               + corr_baja (consecutivo de Resúmenes de Baja) + corr_nota (consecutivo de notas)
 usuario SOL + Clave SOL + certificado PEM cifrados at-rest con LOCAL_MASTER_KEY (lib/crypto)
```

Ruta de baja/corrección fiscal (detalle completo en `docs/06-estados-protocolos.md` §3):

| Endpoint | Método | Función |
|---|---|---|
| `POST /api/caja/comprobantes/[id]/baja` | POST | Baja de un comprobante `aceptado` (motivo ≥3). Boleta → `/voided/send` asíncrono → `baja_pendiente` + ticket. Factura → nota de crédito `tipoDoc 07, codMotivo 01` síncrona → `baja_aceptada` directa |
| `GET /api/caja/comprobantes/[id]/baja` | GET | Consulta el ticket del Resumen de Bajas (`/voided/status`): code 0/CDR ≥4000 → `baja_aceptada`; code 98 → `en_proceso`; resto → `baja_rechazada` |
| `PATCH /api/caja/comprobantes/[id]` | PATCH | Editar serie/correlativo de comprobante `manual` (409 `correlativo_ocupado`) |
| `DELETE /api/caja/comprobantes/[id]` | DELETE | Anular comprobante `manual` (borrado físico + audit; no aplica a enviados a SUNAT) |

| Aspecto | Detalle |
|---|---|
| Tablas | `vat_settings` (PK tenant_id: ruc, razon_social, usuario_sol, regimen, ambiente, clave_sol_enc, certificado_enc (PEM base64), series, correlativos, emision), `receipts.sunat_estado`, `receipts.sunat_hash`, `receipts.cdr_url/xml_url`, `receipts.emitida_at` |
| Cifrado | Clave SOL y certificado PEM se guardan cifrados; `LOCAL_MASTER_KEY` env var, se descifran solo en memoria al emitir |
| Sidecar | imagen construida localmente desde `.references/lycet` (`docker compose build lycet`); NO existe en Docker Hub. Puerto host 8090 → contenedor 8000; volumen `lycetdata:/var/www/html/data` |
| Contrato | cada call lleva `?token=`; empresa: `PUT /configuration/company/{ruc}` con `SOL_USER` (RUC+usuario), `SOL_PASS`, `certificate` (PEM base64), `FE_URL` (beta/prod por URL, no hay campo "ambiente"); emisión: `POST /invoice/send`/`/note/send` con shape Greenter camelCase (`mtoValorUnitario`, `porcentajeIgv`…, nota usa `numDocfectado` con el typo original); respuesta siempre HTTP 200: aceptar = `cdrResponse.code == "0"` o ≥ 4000 |
| Artefactos | XML firmado + CDR zip se guardan en `attachmentsRoot()/fiscal/<tenantId>/` y se descargan por `/api/fiscal/archivo/fiscal/<tenant>/<file>` |
| Dependencia externa | licet + RUC / usuario SOL / Clave SOL / certificado **del tenant** (nunca el nuestro). Modo `manual` funciona sin sidecar |
| Reemisión automática | Cron `fiscal` (cada hora, contenedor cron): reintenta comprobantes `pendiente_envio` (≤7 días) y `rechazados` (≤48h) vía `lib/emitir.ts` → `aceptado` o sigue `rechazado` |
| Estado | Implementado y verificado e2e contra SUNAT beta (boleta aceptada con contribuyente demo 20210441213) |

## 2. Inventario odontológico

```
 ingreso (compras/ajustes)                        consumo automático
     │                                                 ▲
     ▼                                                 │
 inventory_items ──▶ inventory_lots (lote, vence)      │
     │ stock/stock_min/costo_unit                      │
     ▼                                                 │
 stock_movements (kardex: ingreso|consumo|ajuste|merma) │
     ▲                                                 │
     └── cita atendida ──▶ service_materials (receta) ─┘
         (transición en_atencion → atendida descuenta la receta del servicio)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `inventory_items` (stock, stock_min, costo_unit), `inventory_lots` (lote, vence, cantidad), `stock_movements` (tipo kardex: ingreso|consumo|ajuste|merma, cantidad, appointment_id), `service_materials` (receta service_id × item_id, unique) |
| Regla | Al transicionar la cita a `atendida` se genera `stock_movements` tipo `consumo` por cada `service_materials` del servicio (descarga **FEFO**: lotes ordenados por `vence ASC NULLS LAST`). El consumo ya es síncrono con el cambio de estado y la respuesta expone `faltantes[]` (items sin stock suficiente, que simplemente no se descuentan); alertas si stock <= stock_min |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 2b. Caja: pagos y cierre (anulación contable + reapertura)

```
 POST /api/caja/pagos            ──▶ payments.estado: valido (default)
 POST /api/caja/pagos/[id]/anular ──▶ anulado (motivo ≥3 chars; nunca borrado físico)
      efectos: commission_entries.monto = 0 · installments → pendiente (pagado 0, payment_id null)
      bloqueo: si el pago tiene comprobante SUNAT aceptado → 409 primero dar de baja el comprobante
      exclusión: cierre/dashboard/sucursales/ingresosPorMetodo ignoran los anulados
 POST /api/caja/cierre             ──▶ cash_closures fila nueva, estado cerrado (cierreSistema excluye anulados)
 POST /api/caja/cierre/[id]/reabrir ──▶ cerrado → reabierto (solo owner, motivo ≥3) + cerrar de nuevo
      el cierre del día se resuelve a la fila más reciente con estado cerrado
```

| Aspecto | Detalle |
|---|---|
| Tablas | `payments.estado` (valido|anulado) + `anulado_por/anulado_at/motivo_anulacion/anulado_con_id`, `cash_closures.estado` (cerrado|reabierto) + `reabierto_por/reabierto_at/motivo_reapertura` |
| Endpoints | `POST /api/caja/pagos/[id]/anular` (payments.register + plan caja), `POST /api/caja/cierre/[id]/reabrir` (solo owner + plan caja) |
| Máquina | `valido → anulado`; cierre `cerrado → reabierto` (+ nuevo cierre). Detalle en `docs/06-estados-protocolos.md` §2 |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 3. Lista de espera anti-huecos

```
 cancelación de cita
     │
     ▼
  hueco liberado ──▶ selección de waitlists activas (prioridad ASC, servicio match)
      │                     │
      │                     ▼
      │              email con magic link (patient_magic_tokens)
      │                     │
      ▼                     ▼
  waitlists.estado: activa → ofrecida → aceptada (se crea cita)
                    ofrecida → activa (re-encolar: no respondió / declinó)
                    activa|ofrecida → retirada
```

| Aspecto | Detalle |
|---|---|
| Tablas | `waitlists` (patient_id, service_id, preferencia, prioridad, estado activa/ofrecida/aceptada/expirada/retirada), `patient_magic_tokens` (link sin cuenta) |
| Máquina | `activa → [ofrecida, retirada]`; `ofrecida → [aceptada, retirada, activa]` (la vuelta `ofrecida → activa` re-encola al paciente para el siguiente hueco). Detalle en `docs/06-estados-protocolos.md` §5 |
| Dependencia externa | Email vía Resend (`RESEND_API_KEY`; sin credencial la oferta queda pendiente en cola) |
| Estado | Implementado en este sprint |

## 4. Reseñas Google post-consulta

```
 cita → atendida
     │  (asíncrono)
     ▼
 review_requests: canal email, enviado_at     ──▶ link directo a reseña (google_review_url)
     respondido: false → true (respondido_at)         configurado en teams
```

| Aspecto | Detalle |
|---|---|
| Tablas | `review_requests` (appointment_id, patient_id, canal, enviado_at, respondido, respondido_at); `teams.google_place_id`, `teams.google_review_url` |
| Dependencia externa | Ninguna (link estático de Google Maps por tenant, sin API) |
| Estado | Implementado en este sprint |

## 5. Presupuestos de tratamiento + cuotas

```
 doctor arma presupuesto
     │
     ▼
 quotes (items jsonb: descripción/cantidad/precio, total, expira_en)
     │  borrador → enviado → aprobado/rechazado → convertido
     │  (al aprobar: email al paciente con detalle y link de reserva)
     ▼
 installments (n, monto, pagado, vence, estado pendiente|parcial|pagada|vencida|cancelada)
     │  POST /api/presupuestos/[id]/cuotas genera n cuotas (1..24) sobre presupuesto aprobado
     ▼
 pago registrado ──▶ POST /api/cuotas/[id]/pagar ──▶ installments.payment_id (linkage), pagada
     │
     └── si TODAS las cuotas del presupuesto quedan pagadas → quote pasa a convertido (auto)
       PATCH /api/cuotas/[id]/pagar → cancelada (reestructurar plan; 400 si pagada)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `quotes` (items jsonb, total, estado, expira_en), `installments` (quote_id, patient_id, n, monto, pagado, vence, estado, payment_id) |
| Máquina | `borrador → [enviado, rechazado]`; `enviado → [aprobado, rechazado]`; `aprobado → [convertido]`; rechazo/convertido terminales. Detalle en `docs/06-estados-protocolos.md` §6 |
| Dependencia externa | Ninguna (email de aprobación vía Resend si está configurado) |
| Estado | Implementado en este sprint |

## 6. Comisiones por doctor

```
 commission_settings: % por membership (doctor)
     │
     ▼
 payment registrado con cita + doctor
     │
     ▼
 commission_entries: base × porcentaje = monto, periodo YYYY-MM
 unique (payment_id, doctor_membership_id) → idempotente (no duplica al reconciliar)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `commission_settings` (PK membership_id, porcentaje), `commission_entries` (doctor_membership_id, payment_id, appointment_id, base, porcentaje, monto, periodo; unique pago+doctor) |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 7. Campañas de cumpleaños / reactivación

```
 cron (contenedor cron, supercronic) ──▶ campaigns (tipo cumple|reactivacion, audiencia jsonb, canal email)
     │                                          │
     │                                          ▼
     └──▶ reminders pipeline (misma cola que recordatorio_24h)
              enviado_a / enviados_ok contadores → estado completada|error
```

| Aspecto | Detalle |
|---|---|
| Tablas | `campaigns` (tipo, titulo, mensaje, canal, estado programada/completada/error, audiencia jsonb, enviado_a, enviados_ok, ejecutada_at), `reminders` (canal, estado) |
| Dependencia externa | Email vía Resend (opcional; sin credencial quedan en estado `error`) |
| Estado | Implementado en este sprint |

## 8. Costos por procedimiento (derivable)

```
 service_materials (receta)  ×  inventory_items.costo_unit
     │                              │
     └──────────┬───────────────────┘
                ▼
 costo material = Σ(cantidad_receta × costo_unit)
 margen = services.precio − costo material   (reporte, sin tabla propia)
```

| Aspecto | Detalle |
|---|---|
| Tablas | Derivable; usa `service_materials`, `inventory_items.costo_unit`, `services.precio` |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 9. Laboratorio / protésico

```
 lab_orders ciclo de vida:
 enviado → fabricacion → recibido → colocado
 fabricacion → enviado ┐
 recibido → fabricacion ├ retrocesos de UN paso, motivo obligatorio ≥3
 colocado → recibido   ┘  (rev +1, motivo_revision guardado)
          ↘ cancelado (desde cualquier estado)

 patient_id + appointment_id; laboratorio, fecha_promesa, costo; alertas por promesa vencida
```

| Aspecto | Detalle |
|---|---|
| Tablas | `lab_orders` (estado enviado/fabricacion/recibido/colocado/cancelado, laboratorio, fecha_promesa, costo, rev, motivo_revision) |
| Endpoint | `PATCH /api/laboratorio/[id]/estado` — avance paso a paso, cancelado desde cualquiera, retroceso exacto de un paso con motivo (400 `motivo_requerido_para_retroceder` / `transicion_invalida`). Detalle en `docs/06-estados-protocolos.md` §4 |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 10. Fotos antes/después

```
 attachments (tipo rx|consentimiento|otro)
     │
     └── galería por tratamiento:
         foto_tipo (ej. antes|progreso|despues) + foto_orden + tratamiento
         foto_orden se asigna automáticamente al subir (max+1 dentro del grupo
         paciente × foto_tipo × tratamiento) y se renumera al reordenar
         agrupación por patient_id + tratamiento → vista comparativa
```

| Aspecto | Detalle |
|---|---|
| Tablas | `attachments.foto_tipo`, `attachments.foto_orden`, `attachments.tratamiento` |
| Endpoints | `POST /api/pacientes/[id]/adjuntos` (subida; asigna `foto_orden` correlativo), `PATCH /api/adjuntos/[id]` (`fotoTipo`/`tratamiento`/**`fotoOrden`**; reordenar por drag & drop en la ficha re-numera desde 1 dentro de la columna), `GET /api/adjuntos/[id]` (servir archivo) |
| Dependencia externa | Ninguna (storage local) |
| Estado | Implementado en este sprint |

## 11. EPS / seguros odontológicos

```
 insurers (catálogo por tenant)
     │
     ▼
 patient_coverages (plan, copago_pct, vigente_desde/hasta, activo)
     │
     ▼
 pago de cita con cobertura:
     monto × copago_pct     → lo paga el paciente (Yape/Plin/etc.)
     monto × (1 − copago%)  → lo factura la EPS (referencia en payment/receipt)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `insurers` (nombre, ruc, telefono), `patient_coverages` (insurer_id, plan, copago_pct, vigencia) |
| Dependencia externa | Ninguna (el cobro a EPS es manual/offline; el split queda registrado) |
| Estado | Implementado en este sprint |

## 12. Multisucursal

```
 branches (nombre, slug, direccion, telefono) por tenant
     │
     ├──▶ services.branch_id
     ├──▶ appointments.branch_id
     └──▶ payments.branch_id
              │
              ▼
 dashboard con benchmark interno: ingresos/ocupación por sucursal
```

| Aspecto | Detalle |
|---|---|
| Tablas | `branches` (unique tenant+slug); columnas `services.branch_id`, `appointments.branch_id`, `payments.branch_id` (nullable = sede única) |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 13. Export SUNAT (registro de ventas)

```
 owner/recepción elige mes
     │
     ▼
 receipts del periodo (correlativos por serie/tipo) + payments
     │
     ▼
 registro de ventas mensual → Excel (exceljs) / CSV descargable
```

| Aspecto | Detalle |
|---|---|
| Tablas | `receipts`, `payments`, `vat_settings` (series/correlativos) |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 14. ARCO — Ley 29733 (protección de datos personales)

```
 solicitud de paciente (información/rectificación/cancelación/oposición)
     │
     ▼
 data_requests (tipo, estado, detalle, gestionado_por)  ← audit trail
     │
     ├── export: ZIP del tenant (patient data + clínica) vía archiver
     ├── rectificación: update de ficha
     └── cancelación: patients.activo = false (soft-delete; historial clínico se conserva
                       por obligación legal, se excluye de búsquedas y reservas)
```

| Aspecto | Detalle |
|---|---|
| Tablas | `data_requests`, `patients.activo`, `patients.antecedentes/medicacion`, `audit_logs` |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |

## 15. PWA offline (instalable + fallback sin conexión)

```
  apps/web
    │
    ├── manifest.webmanifest + iconos SVG (instalable, standalone)
    ├── sw.js (service worker, cache "of-cache-v1")
    │     · install: precache de /offline.html
    │     · fetch: navigations → network-first, fallback offline.html
    │              /_next/static/* e /icons/* → cache-first
    │              API → sin intervención (red normal)
    ├── components/pwa/register.tsx — registro del SW solo en producción
    ├── components/pwa/offline-banner.tsx — banner "sin conexión" via navigator.onLine
    └── lib/offline-store.ts — IndexedDB (idb): guardarBorrador/leerBorrador/eliminarBorrador
                               store "borradores" en DB "odontoflow-offline" (utilidad base;
                               el cacheo de agenda quedará como mejora futura)
```

| Aspecto | Detalle |
|---|---|
| Alcance real | App instalable, page offline de respaldo, caché de assets estáticos, banner de conexión y utilidades IndexedDB listas. El cacheo/replay de agenda es una mejora futura (no se simula). |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint (base PWA completa, sin UI falsa) |

## 16. Hardening de lanzamiento

```
  middleware.ts (edge-safe, solo headers)
    │  /api/* → HSTS, nosniff, referrer-policy, frame-deny, permissions-policy
    ▼
  Rate limiting in-memory (lib/rate-limit.ts)
    login 10/min · signup 5/min · recuperar 5/min · solicitudes públicas 10/min
    slots públicos 60/min · whatsapp webhook 30/min → 429 + Retry-After
    ▼
  GET /api/health → SELECT 1 (timeout 3s) → 200 ok | 503
  scripts/backup.ps1 → pg_dump via WSL/docker → backups/*.dump, retención 30 días
```

| Aspecto | Detalle |
|---|---|
| Archivos | `src/middleware.ts`, `api/health/route.ts`, `scripts/backup.ps1`, rate limits en rutas auth/públicas |
| Dependencia externa | Ninguna |
| Estado | Implementado en este sprint |
