#!/bin/sh
# Respaldo off-site diario de adjuntos y datos fiscales (tar.gz en /backups).
# Ejecutado por supercronic (ver crontab). Best-effort: intenta ambos orígenes
# aunque uno falle, registra cada resultado en infra_backups vía
# /api/cron/backup-log, aplica retención de 30 días y —si RCLONE_REMOTE está
# definido— sube todo /backups al remoto (B2/S3, ver docker/cron/Dockerfile).
# Sin rclone configurado el respaldo queda solo local y se registra "omitido".
set -u
. /etc/supercronic/hc.sh

STAMP="$(date +%Y%m%d_%H%M%S)"
FALLAS=0

hc "$HEALTHCHECK_OFFSITE" /start

# 1. Adjuntos (fotos, archivos, consentimientos): volumen attachments montado
#    read-only en /mnt/attachments por docker-compose.prod.yml.
TAR_ADJ="/backups/adjuntos_${STAMP}.tar.gz"
if tar -C /mnt/attachments -czf "$TAR_ADJ" . 2>/dev/null; then
  SIZE=$(stat -c%s "$TAR_ADJ" 2>/dev/null || echo 0)
  log_backup "{\"kind\":\"adjuntos\",\"status\":\"ok\",\"sizeBytes\":$SIZE}"
else
  FALLAS=1
  log_backup "{\"kind\":\"adjuntos\",\"status\":\"error\",\"detail\":\"tar de /mnt/attachments falló\"}"
fi

# 2. Data fiscal Lycet (PDF/XML SUNAT): volumen lycetdata montado read-only
#    en /mnt/fiscal por docker-compose.prod.yml.
TAR_FIS="/backups/fiscal_${STAMP}.tar.gz"
if tar -C /mnt/fiscal -czf "$TAR_FIS" . 2>/dev/null; then
  SIZE=$(stat -c%s "$TAR_FIS" 2>/dev/null || echo 0)
  log_backup "{\"kind\":\"fiscal\",\"status\":\"ok\",\"sizeBytes\":$SIZE}"
else
  FALLAS=1
  log_backup "{\"kind\":\"fiscal\",\"status\":\"error\",\"detail\":\"tar de /mnt/fiscal falló\"}"
fi

find /backups -name 'adjuntos_*.tar.gz' -mtime +30 -delete
find /backups -name 'fiscal_*.tar.gz' -mtime +30 -delete

# 3. Subida off-site de TODO /backups (dumps pg + tar.gz) al remoto rclone.
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    FALLAS=1
    log_backup "{\"kind\":\"rclone\",\"status\":\"error\",\"detail\":\"rclone no está en la imagen\"}"
  elif ! rclone sync /backups "$RCLONE_REMOTE" --log-level ERROR >/dev/null 2>&1; then
    FALLAS=1
    log_backup "{\"kind\":\"rclone\",\"status\":\"error\",\"detail\":\"rclone sync hacia $RCLONE_REMOTE falló\"}"
  else
    log_backup "{\"kind\":\"rclone\",\"status\":\"ok\"}"
  fi
else
  log_backup "{\"kind\":\"rclone\",\"status\":\"ok\",\"detail\":\"omitido: RCLONE_REMOTE sin definir\"}"
fi

if [ "$FALLAS" -ne 0 ]; then
  hc "$HEALTHCHECK_OFFSITE" /fail
  exit 1
fi
hc "$HEALTHCHECK_OFFSITE"
