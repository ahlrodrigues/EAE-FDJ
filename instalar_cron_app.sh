#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_FILE="$BASE_DIR/atualizar_app.sh"

if [[ ! -x "$SCRIPT_FILE" ]]; then
  chmod +x "$SCRIPT_FILE"
fi

INTERVALO_MINUTOS="${1:-5}"
if ! [[ "$INTERVALO_MINUTOS" =~ ^[0-9]+$ ]] || (( INTERVALO_MINUTOS <= 0 )) || (( INTERVALO_MINUTOS > 60 )); then
  echo "Uso: ./instalar_cron_app.sh [minutos] (1..60)"
  exit 1
fi

CRON_TAG="# eae_fdj_auto_update"
CRON_CMD="*/${INTERVALO_MINUTOS} * * * * /bin/bash \"$SCRIPT_FILE\" $CRON_TAG"

TMP_CRON="$(mktemp)"
trap 'rm -f "$TMP_CRON"' EXIT

crontab -l 2>/dev/null | grep -v "$CRON_TAG" > "$TMP_CRON" || true
echo "$CRON_CMD" >> "$TMP_CRON"
crontab "$TMP_CRON"

echo "Cron instalado com sucesso para executar a cada ${INTERVALO_MINUTOS} minuto(s)."

