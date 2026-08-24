#!/bin/bash
# Limpieza de artefactos QA que acumulan las corridas E2E en la BD de produccion.
#
# - Cancela las citas de reservas "QA Reserva ..." (sin doctor) de hoy en
#   adelante: por la regla "solo el primero gana", CUALQUIER cita sin doctor
#   descarta la franja para el wizard publico -> si se acumulan, mañana se
#   queda sin horarios y el paso 04/05 del E2E falla.
# - Cancela las citas "QA Paciente ..." de fechas pasadas (ruido historico).
#
# Uso: wsl -d Ubuntu -u root -- bash /mnt/c/.../limpiar-qa.sh
set -eo pipefail
PSQL="docker exec odontoflow-prod-db psql -U odontoflow -d odontoflow -t -c"

$PSQL "update appointments a set estado='cancelada', updated_at=now()
from patients p, teams t
where t.id = a.tenant_id and p.id = a.patient_id
  and t.slug='vitalia' and p.nombre like 'QA Reserva %'
  and a.estado not in ('cancelada')
  and (a.fecha > (now() AT TIME ZONE 'America/Lima')::date
       or (a.fecha = (now() AT TIME ZONE 'America/Lima')::date));"

$PSQL "update appointments a set estado='cancelada', updated_at=now()
from patients p, teams t
where t.id = a.tenant_id and p.id = a.patient_id
  and t.slug='vitalia' and p.nombre like 'QA Paciente %'
  and a.estado not in ('cancelada')
  and a.fecha <> (now() AT TIME ZONE 'America/Lima')::date;"

echo "limpieza QA OK"
