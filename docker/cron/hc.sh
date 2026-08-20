#!/bin/sh
# Helper de healthchecks.io para los scripts de respaldo.
# Uso: hc <URL> [sufijo]  (sufijos estándar: /start en inicio, /fail en error).
# Sin URL definida el ping es un no-op: el respaldo sigue funcionando.
hc() {
  _url="${1:-}"
  _sfx="${2:-}"
  [ -n "$_url" ] || return 0
  curl -fsSL --retry 2 -m 10 "${_url}${_sfx}" >/dev/null 2>&1 || true
}

# Registra el resultado del respaldo en la tabla infra_backups vía la API
# interna (Bearer CRON_SECRET). Un fallo de registro NO invalida el respaldo.
log_backup() {
  _payload="$1"
  curl -sf -m 30 -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d "$_payload" \
    http://web:3111/api/cron/backup-log >/dev/null 2>&1 \
    || echo "[backup] aviso: no se pudo registrar el resultado en backup-log" >&2
}
