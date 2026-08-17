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

## Fiscal (implementado — modo manual por defecto, electrónica vía sidecar lycet)

```
vat_settings (tenant_id PK, ruc, razon_social,
              regimen enum: RUS|RER|MYPE,
              ambiente text default 'beta',                -- beta | prod (SUNAT)
              clave_sol_enc, certificado_enc, certificado_pass_enc,  -- cifrados con LOCAL_MASTER_KEY
              certificado_vence date,
              serie_boleta default 'B001', serie_factura default 'F001',
              corr_boleta int, corr_factura int,
              emision enum: manual|electronica)
receipts (id, tenant_id, payment_id unique, tipo enum: boleta|factura|nota_credito|nota_debito,
          serie, correlativo int,
          sunat_estado enum: manual|pendiente_envio|aceptado|rechazado|baja,  -- estado fiscal real
          sunat_hash, cdr_url, xml_url, pdf_url, emitida_at, registrado_por, created_at)
```
Nota: cada tenant usa SU ruc + SU certificado + SU Clave SOL. Nunca el nuestro.
El estado de emisión vive en `receipts.sunat_estado` (enum), ya no en un campo `estado` aparte.
Certificado y Clave SOL se cifran at-rest con `LOCAL_MASTER_KEY` (lib/crypto).

## Post-M5 implementado (migración 0004)

Tablas y columnas nuevas alineadas al schema real (`packages/db/src/schema.ts`).

```
-- Multisucursal
branches (id, tenant_id, nombre, slug, direccion, telefono, activo)
  unique (tenant_id, slug)

-- Inventario
inventory_items (id, tenant_id, nombre, categoria, unidad, stock numeric(12,2),
                stock_min numeric(12,2), costo_unit numeric(10,2), activo)
inventory_lots  (id, item_id, lote, vence date, cantidad numeric(12,2))
stock_movements (id, tenant_id, item_id, tipo enum: ingreso|consumo|ajuste|merma,
                cantidad numeric(12,2), appointment_id nullable, nota, created_by)
service_materials (id, service_id, item_id, cantidad numeric(12,2))  -- receta; unique(service_id,item_id)

-- Laboratorio / protésico
lab_orders (id, tenant_id, patient_id, appointment_id, tipo, laboratorio,
            fecha_promesa date, costo numeric(10,2),
            estado enum: enviado|fabricacion|recibido|colocado|cancelado, notas)

-- Presupuestos + cuotas
quotes (id, tenant_id, patient_id, doctor_id(membership), titulo, items jsonb,
        total numeric(10,2), estado enum: borrador|enviado|aprobado|rechazado|convertido,
        expira_en date, nota)
installments (id, tenant_id, patient_id, quote_id, concepto, n int,
              monto numeric(10,2), pagado numeric(10,2), vence date,
              estado enum: pendiente|parcial|pagada|vencida|cancelada, payment_id)

-- Comisiones por doctor
commission_settings (membership_id PK, porcentaje numeric(5,2), updated_at)
commission_entries (id, tenant_id, doctor_membership_id, payment_id, appointment_id,
                    base numeric(10,2), porcentaje numeric(5,2), monto numeric(10,2), periodo)
                    unique (payment_id, doctor_membership_id)

-- EPS / seguros
insurers (id, tenant_id, nombre, ruc, telefono, activo)
patient_coverages (id, patient_id, insurer_id, plan, copago_pct numeric(5,2),
                   vigente_desde date, vigente_hasta date, activo, notas)

-- Lista de espera anti-huecos
waitlists (id, tenant_id, patient_id, service_id, preferencia, prioridad int default 5,
           estado enum: activa|ofrecida|aceptada|expirada|retirada)

-- Reseñas Google
review_requests (id, tenant_id, appointment_id, patient_id, canal default 'email',
                 enviado_at, respondido bool, respondido_at)

-- Campañas
campaigns (id, tenant_id, tipo enum: cumple|reactivacion, titulo, mensaje, canal,
           estado enum: programada|completada|error, audiencia jsonb,
           enviado_a int, enviados_ok int, ejecutada_at)

-- WhatsApp Cloud API (por tenant)
whatsapp_settings (tenant_id PK, phone_number_id, token_enc, webhook_verified_at, activo)

-- ARCO Ley 29733
data_requests (id, tenant_id, patient_id, tipo, estado default 'pendiente',
               detalle, gestionado_por)

-- Columnas nuevas sobre tablas existentes
teams.restringir_fuera_horario bool      -- restricción opcional fuera de horario
teams.google_place_id text               -- reseñas Google
teams.google_review_url text
patients.antecedentes text
patients.medicacion text
patients.activo bool default true        -- soft-delete ARCO
receipts.sunat_estado enum               -- ver sección Fiscal
receipts.sunat_hash, cdr_url, xml_url, pdf_url, emitida_at
attachments.foto_tipo text               -- antes/después
attachments.foto_orden int
attachments.tratamiento text
services.branch_id uuid
appointments.branch_id uuid
payments.branch_id uuid
```

## Reglas de negocio clave
- Multi-tenancy: toda query filtra tenant_id; middleware valida membership+role+turno.
- Doctor puede pertenecer a varios tenants con rol doctor.
- Offboarding: revocar acceso inmediato (los datos viven en el sistema, no en el aparato).
- Cifrado en tránsito (TLS) + at-rest para certificados/clave SOL. Respeta Ley 29733.
