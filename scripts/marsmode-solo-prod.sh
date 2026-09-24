#!/usr/bin/env bash
# marsmode-solo-prod.sh — deja corriendo SOLO el proyecto prod indicado.
# Detiene todo contenedor de otro proyecto compose (dev/clinicflow/etc.) y le
# quita la politica restart para que el daemon no lo auto-encienda al arrancar.
# Uso: bash marsmode-solo-prod.sh [proyecto]   (default: odontoflow-prod)
set -u
PROYECTO="${1:-odontoflow-prod}"

ids=$(sudo docker ps -q)
for id in $ids; do
  labels=$(sudo docker inspect -f '{{.Config.Labels}}' "$id")
  case "$labels" in
    *com.docker.compose.project:$PROYECTO*)
      ;;
    *)
      sudo docker update --restart=no "$id" >/dev/null 2>&1
      sudo docker stop "$id" >/dev/null 2>&1
      ;;
  esac
done

sudo docker ps --format '{{.Names}}'
