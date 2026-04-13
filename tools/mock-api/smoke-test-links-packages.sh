#!/usr/bin/env bash
set -euo pipefail

# Smoke test do mock-api: vínculos + requests + packages (response)
#
# Requisitos:
# - mock rodando em http://127.0.0.1:8789
#
# Executar:
#   bash tools/mock-api/smoke-test-links-packages.sh

BASE="${MOCK_API_BASE_URL:-http://127.0.0.1:8789}"

node_sha256() {
  node -e "console.log(require('crypto').createHash('sha256').update(String(process.argv[1]||''),'utf8').digest('hex'))" "$1"
}

json_get() {
  # json_get '<expr>'  (expr em JS usando "j")
  node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(0,'utf8')); const v=(${1}); if (v==null) process.exit(2); if (typeof v==='object') console.log(JSON.stringify(v)); else console.log(String(v));"
}

say() { printf "%s\n" "$*"; }
fail() { say "❌ $*"; exit 1; }

say "[smoke] base=$BASE"

# 0) health
health="$(curl -s "$BASE/api/health" || true)"
echo "$health" | json_get "j.ok" >/dev/null 2>&1 || fail "healthcheck falhou: $health"
nowISO="$(echo "$health" | json_get "j.nowISO" || true)"
say "[smoke] ✅ health $nowISO"

dirigenteId="$(node_sha256 "dirigente@test.local")"
alunoId="$(node_sha256 "aluno@test.local")"
outroDirigenteId="$(node_sha256 "dirigente2@test.local")"
alunoSemLinkId="$(node_sha256 "aluno2@test.local")"

say "[smoke] ids:"
say "  dirigenteId=$dirigenteId"
say "  alunoId=$alunoId"

# 1) request sem vínculo deve falhar (403)
status_no_link="$(curl -s -o /tmp/smoke_req_nolink.json -w "%{http_code}" \
  -X POST "$BASE/api/requests" \
  -H "content-type: application/json" \
  -d "{\"fromId\":\"$outroDirigenteId\",\"toId\":\"$alunoSemLinkId\",\"type\":\"materials_request\"}")"
[[ "$status_no_link" == "403" ]] || fail "esperado 403 sem vínculo; veio $status_no_link ($(cat /tmp/smoke_req_nolink.json))"
say "[smoke] ✅ request sem vínculo bloqueado (403)"

# 2) criar convite de vínculo
invite="$(curl -s -X POST "$BASE/api/links/invite" -H "content-type: application/json" -d "{\"dirigenteId\":\"$dirigenteId\",\"alunoId\":\"$alunoId\"}")"
echo "$invite" | json_get "j.ok" >/dev/null 2>&1 || fail "invite falhou: $invite"
linkId="$(echo "$invite" | json_get "j.link.linkId")"
status_link="$(echo "$invite" | json_get "j.link.status")"
say "[smoke] ✅ link invite linkId=$linkId status=$status_link"

# 3) confirmar vínculo como aluno
confirm="$(curl -s -X POST "$BASE/api/links/$linkId/confirm" -H "content-type: application/json" -d "{\"actorId\":\"$alunoId\"}")"
echo "$confirm" | json_get "j.ok" >/dev/null 2>&1 || fail "confirm falhou: $confirm"
active="$(echo "$confirm" | json_get "j.link.status")"
[[ "$active" == "active" ]] || fail "vínculo não ficou active: $confirm"
say "[smoke] ✅ link confirm (active)"

# 4) criar request com vínculo ativo
req="$(curl -s -X POST "$BASE/api/requests" -H "content-type: application/json" -d "{\"fromId\":\"$dirigenteId\",\"toId\":\"$alunoId\",\"type\":\"materials_request\"}")"
echo "$req" | json_get "j.ok" >/dev/null 2>&1 || fail "create request falhou: $req"
requestId="$(echo "$req" | json_get "j.request.requestId")"
say "[smoke] ✅ request criada requestId=$requestId"

# 5) criar package response para a request
pkg="$(curl -s -X POST "$BASE/api/packages" -H "content-type: application/json" -d "{\"kind\":\"response\",\"requestId\":\"$requestId\",\"fromId\":\"$alunoId\",\"sha256\":\"dev\",\"size\":1,\"contentType\":\"application/json\"}")"
echo "$pkg" | json_get "j.ok" >/dev/null 2>&1 || fail "create package falhou: $pkg"
packageId="$(echo "$pkg" | json_get "j.packageId")"
uploadUrl="$(echo "$pkg" | json_get "j.uploadUrl")"
say "[smoke] ✅ package criada packageId=$packageId"

# 6) upload blob
tmpBlob="$(mktemp /tmp/smoke_blob.XXXXXX.json)"
node -e "require('fs').writeFileSync(process.argv[1], JSON.stringify({hello:'world', requestId: process.argv[2], alunoId: process.argv[3]}, null, 2), 'utf8')" "$tmpBlob" "$requestId" "$alunoId"
putStatus="$(curl -s -o /tmp/smoke_put.json -w "%{http_code}" -X PUT "$uploadUrl" -H "content-type: application/octet-stream" --data-binary @"$tmpBlob")"
[[ "$putStatus" =~ ^2 ]] || fail "upload falhou ($putStatus): $(cat /tmp/smoke_put.json)"
upSize="$(cat /tmp/smoke_put.json | json_get "j.size" || true)"
say "[smoke] ✅ upload ok size=$upSize"

# 7) listar packages pendentes do dirigente
list="$(curl -s "$BASE/api/packages?to=$dirigenteId&status=pending&available=1")"
echo "$list" | json_get "j.ok" >/dev/null 2>&1 || fail "list packages falhou: $list"
hasPkg="$(echo "$list" | node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8'));const arr=j.packages||[];process.exit(arr.some(p=>p.packageId===process.argv[1])?0:3)" "$packageId"; echo $?)"
[[ "$hasPkg" == "0" ]] || fail "package não apareceu na lista do dirigente: $list"
say "[smoke] ✅ list packages ok"

# 8) download blob
tmpDl="$(mktemp /tmp/smoke_dl.XXXXXX.bin)"
dlStatus="$(curl -s -o "$tmpDl" -w "%{http_code}" "$BASE/api/packages/$packageId/blob")"
[[ "$dlStatus" =~ ^2 ]] || fail "download falhou ($dlStatus)"
sz1="$(wc -c < "$tmpBlob" | tr -d ' ')"
sz2="$(wc -c < "$tmpDl" | tr -d ' ')"
[[ "$sz1" == "$sz2" ]] || fail "tamanho divergente: upload=$sz1 download=$sz2"
say "[smoke] ✅ download ok size=$sz2"

# 9) marcar downloaded
down="$(curl -s -X POST "$BASE/api/packages/$packageId/downloaded" -H "content-type: application/json" -d "{\"downloadedAtISO\":\"$(date -Iseconds)\"}")"
echo "$down" | json_get "j.ok" >/dev/null 2>&1 || fail "mark downloaded falhou: $down"
say "[smoke] ✅ downloaded ok"

# 10) marcar applied e garantir limpeza
app="$(curl -s -X POST "$BASE/api/packages/$packageId/applied" -H "content-type: application/json" -d "{\"ok\":true,\"appliedAtISO\":\"$(date -Iseconds)\"}")"
echo "$app" | json_get "j.ok" >/dev/null 2>&1 || fail "mark applied falhou: $app"
say "[smoke] ✅ applied ok"

after="$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/packages/$packageId/blob" || true)"
[[ "$after" == "410" || "$after" == "404" ]] || fail "esperado blob removido; veio $after"
say "[smoke] ✅ blob removido após applied ($after)"

rm -f "$tmpBlob" "$tmpDl" /tmp/smoke_req_nolink.json /tmp/smoke_put.json

say "[smoke] ✅✅ smoke test concluído com sucesso"

