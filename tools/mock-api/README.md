# Mock API + WebSocket (DEV)

Servidor local para testar o fluxo do app:
- WebSocket apenas para aviso de atualização (`updateAvailable`)
- Pull via HTTP (manifest + itens)

## Rodar

1) Terminal 1:
`npm run mock-api`

2) Terminal 2:
`npm start`

Opcional (DEV): forçar pull mesmo na tela de login:
`SYNC_HTTP_BASE_URL=http://127.0.0.1:8789 SYNC_TURMA_ID=TurmaIdA1B2C3 SYNC_DEV_AUTO_PULL=1 npm start`

No app, em `Integrações`, use:
- Base HTTP: `http://127.0.0.1:8789`
- WS: `ws://127.0.0.1:8789/ws`
- TurmaId: `TurmaIdA1B2C3` (ou outro no mesmo formato)

## Disparar aviso de atualização (banner)

`curl -X POST http://127.0.0.1:8789/api/turmas/TurmaIdA1B2C3/notify-update`
