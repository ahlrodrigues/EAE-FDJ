# Versionamento e deploy (rotina espelhada do dashboard_técnico)

Este projeto espelha a rotina do `dashboard_técnico` com:

- **release**: bump semver + commit + push opcional
- **deploy/update** (opcional): `git pull --ff-only` + `npm install` (pode ser agendado via cron)

## Release

Fonte da versão: `package.json#version`.

Comandos:

- `./release_app.sh patch`
- `./release_app.sh minor --push`
- `./release_app.sh major --message "Sua mensagem"`

## Update/deploy (opcional)

Executar atualização local (log em `atualizar_app.log`):

- `./atualizar_app.sh`

Instalar cron (por padrão, a cada 5 min):

- `./instalar_cron_app.sh`
- `./instalar_cron_app.sh 10`

Observações:

- `git pull --ff-only` evita merges automáticos em rotinas.
- Para desktop (Electron), “deploy” aqui significa manter o repositório e dependências atualizados. O start do app continua manual (`npm start`).

