#!/bin/sh
# Respaldo diario de la base de datos Odontoflow (formato custom de pg_dump).
# Ejecutado por supercronic dentro del contenedor cron (ver crontab).
# El volumen /backups mapea a ./backups del host en docker-compose.prod.yml.
# Retención: 30 días (misma política que scripts/backup.ps1 de dev).
# El resultado se registra en infra_backups vía /api/cron/backup-log y, si
# HEALTHCHECK_DB está definido, se pinge healthchecks.io (/start, ok o /fail).
set -u
. /etc/supercronic/hc.sh

DIR="/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$DIR/odontoflow_backup_${STAMP}.dump"

hc "$HEALTHCHECK_DB" /start

if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "${DATABASE_HOST:-db}" \
  -p "${DATABASE_PORT:-5432}" \
  -U "${POSTGRES_USER:-odontoflow}" \
  -d "${POSTGRES_DB:-odontoflow}" \
  -Fc -f "$OUT"; then
  hc "$HEALTHCHECK_DB" /fail
  log_backup "{\"kind\":\"pg_dump\",\"status\":\"error\",\"detail\":\"pg_dump falló\"}"
  exit 1
fi

SIZE=$(stat -c%s "$OUT" 2>/dev/null || wc -c < "$OUT")
echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') escrito $OUT ($(du -h "$OUT" | cut -f1))"

find "$DIR" -name 'odontoflow_backup_*.dump' -mtime +30 -delete

hc "$HEALTHCHECK_DB"
log_backup "{\"kind\":\"pg_dump\",\"status\":\"ok\",\"sizeBytes\":$SIZE}"
