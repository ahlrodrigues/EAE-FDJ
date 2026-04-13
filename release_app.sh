#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NODE_BIN="node"

usage() {
  cat <<'EOF'
Uso:
  ./release_app.sh patch
  ./release_app.sh minor --push
  ./release_app.sh major --message "Sua mensagem"
  ./release_app.sh patch --push --message "Sua mensagem"

Opções:
  patch|minor|major   Tipo de incremento semântico
  --push              Envia o commit para o remoto após concluir
  --message TEXTO     Sobrescreve a mensagem gerada automaticamente
EOF
}

require_clean_index() {
  if ! git diff --quiet --cached; then
    echo "Há alterações já staged. Conclua ou limpe o staging antes de usar o release_app.sh."
    exit 1
  fi
}

current_branch() { git branch --show-current; }
fetch_remote_state() { git fetch --prune origin; }

ensure_branch_tracks_remote() {
  local branch="$1"
  if ! git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    echo "A branch origin/$branch não foi encontrada. Configure o tracking antes de usar o release_app.sh."
    exit 1
  fi
}

ensure_branch_up_to_date() {
  local branch="$1"
  local local_sha remote_sha base_sha

  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse "origin/$branch")"
  base_sha="$(git merge-base HEAD "origin/$branch")"

  if [[ "$local_sha" == "$remote_sha" ]]; then
    return
  fi

  if [[ "$local_sha" == "$base_sha" ]]; then
    echo "A branch local $branch está atrás de origin/$branch. Atualize com merge/rebase antes do release."
    exit 1
  fi

  if [[ "$remote_sha" == "$base_sha" ]]; then
    echo "A branch local $branch tem commits não enviados. O release pode prosseguir, mas faça conscientemente."
    return
  fi

  echo "A branch local $branch divergiu de origin/$branch. Resolva antes do release."
  exit 1
}

collect_changed_files() {
  git status --short --untracked-files=all | awk '{print $2}'
}

append_part() {
  local value="$1"
  if [[ -z "$value" ]]; then
    return
  fi
  MESSAGE_PARTS+=("$value")
}

join_with_and() {
  local items=("$@")
  local count="${#items[@]}"
  if (( count == 0 )); then printf '%s' ""; return; fi
  if (( count == 1 )); then printf '%s' "${items[0]}"; return; fi
  if (( count == 2 )); then printf '%s and %s' "${items[0]}" "${items[1]}"; return; fi
  local result=""
  local i
  for (( i=0; i<count; i++ )); do
    if (( i == count - 1 )); then result+="and ${items[i]}"; else result+="${items[i]}, "; fi
  done
  printf '%s' "$result"
}

generate_commit_message() {
  local changed_files_text="$1"
  MESSAGE_PARTS=()

  if grep -Eq '^(backend/|main\.js|preload\.js)$' <<<"$changed_files_text"; then append_part "backend changes"; fi
  if grep -Eq '^frontend/' <<<"$changed_files_text"; then append_part "UI updates"; fi
  if grep -Eq '^(tools/|bump_version\.js|release_app\.sh)$' <<<"$changed_files_text"; then append_part "tooling"; fi
  if grep -Eq '^(docs/|README\.md|PLANO_DE_ACAO\.txt)$' <<<"$changed_files_text"; then append_part "docs"; fi
  if grep -Eq '^(package\.json|package-lock\.json)$' <<<"$changed_files_text"; then append_part "dependencies"; fi

  local joined
  joined="$(join_with_and "${MESSAGE_PARTS[@]}")"
  if [[ -z "$joined" ]]; then
    echo "Update project files"
    return
  fi
  echo "Update $joined"
}

TYPE="${1:-}"
if [[ -z "$TYPE" ]]; then
  usage
  exit 1
fi
shift

case "$TYPE" in
  patch|minor|major) ;;
  -h|--help) usage; exit 0 ;;
  *) echo "Tipo inválido: $TYPE"; usage; exit 1 ;;
esac

PUSH=false
CUSTOM_MESSAGE=""

while (( "$#" )); do
  case "$1" in
    --push) PUSH=true; shift ;;
    --message)
      if (( "$#" < 2 )); then
        echo "A opção --message exige um texto."
        exit 1
      fi
      CUSTOM_MESSAGE="$2"
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opção inválida: $1"; usage; exit 1 ;;
  esac
done

command -v "$NODE_BIN" >/dev/null 2>&1 || { echo "node não encontrado."; exit 1; }

require_clean_index
BRANCH="$(current_branch)"
[[ -n "$BRANCH" ]] || { echo "Não foi possível identificar a branch atual."; exit 1; }

fetch_remote_state
ensure_branch_tracks_remote "$BRANCH"
ensure_branch_up_to_date "$BRANCH"

CHANGED_FILES="$(collect_changed_files)"
[[ -n "$CHANGED_FILES" ]] || { echo "Não há alterações para versionar."; exit 1; }

COMMIT_MESSAGE="$CUSTOM_MESSAGE"
if [[ -z "$COMMIT_MESSAGE" ]]; then
  COMMIT_MESSAGE="$(generate_commit_message "$CHANGED_FILES")"
fi

NEW_VERSION="$("$NODE_BIN" "$ROOT_DIR/bump_version.js" "$TYPE")"
echo "Versão atualizada para $NEW_VERSION"

git add -A
git commit -m "$COMMIT_MESSAGE"

if [[ "$PUSH" == true ]]; then
  fetch_remote_state
  ensure_branch_tracks_remote "$BRANCH"
  ensure_branch_up_to_date "$BRANCH"
  git push
fi

echo "Release concluído."
echo "Versão: $NEW_VERSION"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Mensagem: $COMMIT_MESSAGE"

