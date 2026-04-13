# Sync API (WebSocket + Pull HTTP) — `api.geea.com.br`

Este documento descreve o contrato mínimo para o app Electron **ser avisado de atualizações** (WebSocket) e **baixar conteúdo sob demanda** (HTTP).

O app:
- Mantém conteúdo **offline** após baixar.
- Usa WebSocket **apenas para aviso** (“updateAvailable”).
- Faz download via HTTP quando o aluno clica em **Atualizar**.

## Identificadores

### `turmaId`
Formato sugerido: `TurmaId` + letras/números aleatórios (ex.: `TurmaIdA1B2C3`).

## WebSocket (aviso de atualização)

Endpoint:
- `wss://api.geea.com.br/ws`

Query params (opcionais):
- `token=<bearer>` (se usar autenticação)
- `turmaId=<TurmaId...>` (pode ser usado para auto-subscribe)

Mensagem de subscribe (opcional, mas recomendado para multi-turma):
```json
{ "type": "subscribe", "turmaId": "TurmaIdA1B2C3" }
```

Evento emitido pelo servidor quando houver atualização:
```json
{
  "type": "updateAvailable",
  "turmaId": "TurmaIdA1B2C3",
  "manifestVersion": 12,
  "updatedAtISO": "2026-04-11T15:30:00Z",
  "summary": "Novos temas e aviso do dirigente"
}
```

O app **não baixa automaticamente** ao receber o evento; apenas mostra um banner “Atualizar”.

## HTTP Pull (manifest + itens)

### 1) Manifest da turma

Endpoint:
- `GET https://api.geea.com.br/api/turmas/:turmaId/manifest`

Headers (opcionais):
- `Authorization: Bearer <token>`
- `If-None-Match: <etag>` (recomendado)

Respostas:
- `200 OK` com manifest
- `304 Not Modified` (quando ETag não mudou)

Exemplo de manifest:
```json
{
  "schemaVersion": 1,
  "turmaId": "TurmaIdA1B2C3",
  "manifestVersion": 12,
  "updatedAtISO": "2026-04-11T15:30:00Z",
  "minAppVersion": "1.0.0",
  "items": [
    {
      "type": "tema_catalog",
      "id": "global",
      "version": 5,
      "url": "/api/content/tema_catalog/global?v=5",
      "sha256": "8f3f6e8c5b4a3b2c1d...f00d",
      "sizeBytes": 184220
    },
    {
      "type": "tema_schedule",
      "id": "TurmaIdA1B2C3",
      "version": 12,
      "url": "/api/turmas/TurmaIdA1B2C3/tema-schedule?v=12",
      "sha256": "1a2b3c4d...beef",
      "sizeBytes": 24530
    }
  ]
}
```

Campos:
- `schemaVersion` (int): versão do schema do manifest.
- `manifestVersion` (int): versão global da turma (sobe quando qualquer item muda).
- `items[]`: lista de itens versionados.

Item:
- `type` (string): tipo do conteúdo.
- `id` (string): id do item (ex.: `global` ou o próprio `turmaId`).
- `url` (string): URL relativa (o app prefixa com a base HTTP).
- `sha256` (string, opcional): hash de integridade do **JSON serializado** baixado.
- `version`/`sizeBytes` (opcionais): metadados úteis para debug/telemetria.

### 2) Item: `tema_catalog` (global)

Endpoint:
- `GET https://api.geea.com.br/api/content/tema_catalog/global`

Exemplo:
```json
{
  "schemaVersion": 1,
  "type": "tema_catalog",
  "version": 5,
  "items": [
    {
      "temaNumero": 1,
      "temaTitulo": "Seu mau humor não modifica a vida.",
      "temaLabel": "1. Seu mau humor não modifica a vida."
    },
    {
      "temaNumero": 2,
      "temaTitulo": "Nunca desanime diante das lutas.",
      "temaLabel": "2. Nunca desanime diante das lutas."
    }
  ]
}
```

Observações:
- `temaNumero` é o identificador humano (número do tema).
- O app usa `tema_catalog` para montar o título quando o schedule só tem número+data.

### 3) Item: `tema_schedule` (por turma)

Endpoint:
- `GET https://api.geea.com.br/api/turmas/:turmaId/tema-schedule`

Exemplo (mínimo recomendado):
```json
{
  "schemaVersion": 1,
  "type": "tema_schedule",
  "turmaId": "TurmaIdA1B2C3",
  "version": 12,
  "timezone": "America/Sao_Paulo",
  "publishedAtHourLocal": "06:00",
  "items": [
    { "temaNumero": 1, "dataPublicacaoISO": "2026-04-13" },
    { "temaNumero": 2, "dataPublicacaoISO": "2026-04-20" }
  ]
}
```

Notas:
- `dataPublicacaoISO` é **data** (YYYY-MM-DD). A hora efetiva pode vir de `publishedAtHourLocal`.
- O schedule **não precisa** repetir o título: o app completa via `tema_catalog`.

### 4) Item: `aviso_dirigente_feed` (por turma)

Endpoint:
- `GET https://api.geea.com.br/api/turmas/:turmaId/aviso-dirigente-feed`

Exemplo:
```json
{
  "schemaVersion": 1,
  "type": "aviso_dirigente_feed",
  "turmaId": "TurmaIdA1B2C3",
  "version": 3,
  "items": [
    {
      "id": "aviso-001",
      "titulo": "Aviso do Dirigente",
      "mensagem": "Bem-vindos! ...",
      "publicadoEmISO": "2026-04-11T12:00:00-03:00"
    }
  ]
}
```

### 5) Item: `mensagem_mentor_turma` (por turma)

Endpoint:
- `GET https://api.geea.com.br/api/turmas/:turmaId/mensagem-mentor-turma`

Exemplo:
```json
{
  "schemaVersion": 1,
  "type": "mensagem_mentor_turma",
  "turmaId": "TurmaIdA1B2C3",
  "version": 3,
  "mensagem": "Mensagem do mentor da turma...",
  "publicadoEmISO": "2026-04-11T12:10:00-03:00"
}
```

### 6) Item: `programa_aulas_eae` (global)

Objetivo:
- Referência padronizada para o dirigente gerar o `tema_schedule` a partir do **Programa de Aulas** da EAE.

Endpoint (sugestão):
- `GET https://api.geea.com.br/api/content/programa_aulas_eae/global`

Exemplo (mínimo recomendado):
```json
{
  "schemaVersion": 1,
  "type": "programa_aulas_eae",
  "version": 1,
  "temaMap": [
    { "aulaNumero": 13, "temaNumero": 1 },
    { "aulaNumero": 18, "temaNumero": 2 }
  ]
}
```

### 7) Item: `programa_aulas_eae_schedule` (por turma)

Objetivo:
- Dirigente define a **data de cada aula** (1..118). O `tema_schedule` pode ser derivado automaticamente a partir dessas datas.

Endpoint (sugestão):
- `GET https://api.geea.com.br/api/turmas/:turmaId/programa-aulas-schedule`

Exemplo:
```json
{
  "schemaVersion": 1,
  "type": "programa_aulas_eae_schedule",
  "turmaId": "TurmaIdA1B2C3",
  "version": 3,
  "timezone": "America/Sao_Paulo",
  "items": [
    { "aulaNumero": 1, "dataAulaISO": "2026-04-13" },
    { "aulaNumero": 2, "dataAulaISO": "2026-04-20" }
  ],
  "updatedAtISO": "2026-04-11T15:30:00Z"
}
```

## Persistência local (app)

O app salva conteúdo baixado em:
- `~/.config/escola-aprendizes/content/<turmaId>/manifest.json`
- `~/.config/escola-aprendizes/content/<turmaId>/items/<type>/<id>.json`

## Configuração no app

Tela:
- `Integrações` → `frontend/integracoes.html`

Campos:
- Base URL (HTTP): `https://api.geea.com.br`
- URL (WebSocket): `wss://api.geea.com.br/ws` (pode ser derivada automaticamente do HTTP)
- Turma ID: `TurmaId...`
- Token (opcional)
