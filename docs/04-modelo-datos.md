# Modelo de datos (incrementos sobre BoxyHQ saas-starter-kit)

Base aportada por BoxyHQ (headless): users, organizations(=tenants), memberships,
invitations, api_keys, webhooks. SOBRE esas tablas se extiende el dominio dental.

Convención: TODA tabla de dominio lleva `tenant_id` (= organization_id). Índices por tenant_id.

## Núcleo (M0-M2)

```
-- miembros del staff y su acceso
memberships.role        enum: owner | receptionist | assistant | doctor   (extiende BoxyHQ)
staff_schedules (id, membership_id, dia_semana 0-6, hora_ini, hora_fin)
access_rules    (id, tenant_id, restringir_fuera_horario bool default false)

-- catálogo
services (id, tenant_id, nombre, duracion_min, precio numeric(10,2), activo bool,
          codigo_procedimiento, creado_por, created_at)

-- agenda / citas
appointments (id, tenant_id, service_id, doctor_id, patient_id,
          fecha date, hora_ini time, hora_fin time,
          estado enum: solicitada|confirmada|en_espera|en_atencion|atendida|no_show|cancelada,
          preferencia_doctor_id nullable,    -- la pide el paciente, sin agenda
          modo_solicitud bool default true,
          monto numeric(10,2), monto_pagado numeric(10,2) default 0,
          notas, creado_por, created_at, updated_at)

-- pacientes + intake
patients (id, tenant_id, nombre, celular, email, documento, fnac date,
          alergias text, medicamentos text, gestacion bool, enfermedades text,
          creado_por, created_at)
intake_forms (id, patient_id, appointment_id, payload jsonb, created_at)

-- ficha clínica
clinical_records (id, patient_id, appointment_id, nota text, adjuntos jsonb,
          creado_por, created_at)

-- odontograma
tooth_states (id, patient_id, tooth_fdi int,   -- numeración FDI 2 dígitos
          estado enum: sano|cariado|tratado|extraido|corona|ausente,
          nota, updated_by, updated_at)
teeth_chart (patient_id, snapshot jsonb)        -- opcional cache

-- consentimientos
consents (id, patient_id, appointment_id, tipo, firma_url/pdf_url,
          firmado_en timestamp, witnessed_by)

-- pagos (caja manual)
payments (id, tenant_id, appointment_id nullable, paciente_id nullable,
          monto numeric(10,2), metodo enum: yape|plin|efectivo|tarjeta_pos|tarjeta_online|otro,
          referencia text, registrado_por, caja_cerrada bool default false,
          created_at)

-- cierre de caja / conciliación
cash_closures (id, tenant_id, fecha date, apertura numeric, cierre_real numeric,
               cierre_sistema numeric, diferencia numeric, cerrado_por, estado)

-- recordatorios
reminders (id, appointment_id, canal enum: email|sms|whatsapp, estado enum: programado|enviado|error,
           costo numeric, enviado_at)

-- suscripciones (a NOSOTROS, manual)
subscriptions (id, tenant_id, plan enum: free|pro|premium, estado enum: activo|por_renovar|suspendido|cancelado,
               vence date, monto numeric, metodo_pago text, nota, gestionado_por)

-- audit
audit_logs (id, tenant_id, user_id, accion, entidad, entidad_id, ip, payload jsonb, created_at)
```

## Fiscal (fase futura — se crea en M3 en modo manual para no reescribir)

```
vat_settings (tenant_id PK, ruc, regimen enum: RUS|RER|MYPE, clave_sol_enc text,
              serie_boleta, serie_factura, corr_boleta int, corr_factura int,
              emision enum: manual|electronica)
certificates (tenant_id, file_enc_pfx bytea, password_enc text, vence date, estado)
receipts (id, tenant_id, payment_id, tipo enum: boleta|factura|nota_credito|nota_debito,
          serie, correlativo, sunat_hash, cdr_url, xml_url, pdf_url,
          estado enum: manual|pendiente_envio|aceptado|rechazado|baja, created_at)
```
Nota: cada tenant usa SU ruc + SU certificado + SU Clave SOL. Nunca el nuestro.

## Backlog (tablas previstas)

```
inventory_items  (id, tenant_id, nombre, categoria, unidad, stock numeric, stock_min, costo_unit)
inventory_lots   (id, item_id, lote, vence date, cantidad)
stock_movements  (id, item_id, tipo enum: ingreso|consumo|ajuste|merma, cantidad, appointment_id nullable, creado_por)
service_materials(id, service_id, item_id, cantidad)          -- receta de materiales
waitlists        (id, tenant_id, patient_id, service_id, prioridad, estado)
review_requests  (id, tenant_id, appointment_id, paciente_id, enviado_at, respondido bool)
lab_orders       (id, tenant_id, patient_id, tipo, fecha_promesa, estado, costo)
campaigns        (id, tenant_id, tipo enum: cumple|reactivacion, estado)
quotes           (id, tenant_id, patient_id, doctor_id, items jsonb, estado enum: borrador|enviado|aprobado)
installments     (id, quote_id, n int, monto, vence, estado)
commissions      (id, tenant_id, doctor_id, payment_id, porcentaje, monto)
```

## Reglas de negocio clave
- Multi-tenancy: toda query filtra tenant_id; middleware valida membership+role+turno.
- Doctor puede pertenecer a varios tenants con rol doctor.
- Offboarding: revocar acceso inmediato (los datos viven en el sistema, no en el aparato).
- Cifrado en tránsito (TLS) + at-rest para certificados/clave SOL. Respeta Ley 29733.
