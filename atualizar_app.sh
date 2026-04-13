#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

LOG_FILE="$BASE_DIR/atualizar_app.log"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando atualização do app"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Branch: $(git branch --show-current || echo '?')"

  git fetch --prune origin

  # Atualização segura (evita merges automáticos em rotinas)
  git pull --ff-only

  if command -v npm >/dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Instalando dependências (npm install)"
    npm install
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] npm não encontrado; pulando instalação"
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Atualização concluída"
} >> "$LOG_FILE" 2>&1

