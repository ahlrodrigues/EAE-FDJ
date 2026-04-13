#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Cria/atualiza um usuário DEV no "novo modelo" dentro de um HOME isolado.
 *
 * Exemplo:
 *   HOME=/tmp/eae_home_dev node tools/dev/create-dev-user.js \
 *     --email tonicoparacleto@local.test \
 *     --password Toni#2026 \
 *     --roles aluno,dirigente,analista \
 *     --syncBase http://127.0.0.1:8789 \
 *     --syncWs ws://127.0.0.1:8789/ws \
 *     --turmaId TurmaIdA1B2C3
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

function arg(name, fallback = "") {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function usage() {
  console.log("Uso: node tools/dev/create-dev-user.js --email <email> --password <senha> [--roles a,b,c] [--syncBase <url>] [--syncWs <url>] [--turmaId <id>]");
}

const email = String(arg("email")).trim().toLowerCase();
const password = String(arg("password")).trim();
if (!email || !email.includes("@") || !password) {
  usage();
  process.exit(1);
}

const rolesRaw = String(arg("roles", "aluno")).trim();
const roles = Array.from(new Set(rolesRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)));

const syncBase = String(arg("syncBase", "http://127.0.0.1:8789")).trim().replace(/\/+$/, "");
const syncWs = String(arg("syncWs", "ws://127.0.0.1:8789/ws")).trim();
const turmaId = String(arg("turmaId", "TurmaIdA1B2C3")).trim();

const home = process.env.HOME || "";
if (!home) {
  console.error("HOME não definido. Rode com HOME=/tmp/algum_dir ...");
  process.exit(1);
}

const emailHash = crypto.createHash("sha256").update(email, "utf8").digest("hex");

const baseDir = path.join(home, ".config", "escola-aprendizes", "config");
const usersDir = path.join(baseDir, "usuarios");
const indexPath = path.join(baseDir, "index.json");
const userPath = path.join(usersDir, `${emailHash}.json`);

fs.mkdirSync(usersDir, { recursive: true });

const senhaCriptografada = bcrypt.hashSync(password, 10);
const nowISO = new Date().toISOString();

const user = {
  schemaVersion: 1,
  roles,
  senhaCriptografada,
  idioma: "pt-BR",
  remoteSync: {
    httpBaseUrl: syncBase,
    wsUrl: syncWs,
    turmaId,
    token: "",
  },
  createdAt: nowISO,
  updatedAt: nowISO,
  versao: 1,
};

fs.writeFileSync(userPath, JSON.stringify(user, null, 2), "utf8");

let index = { usuarios: {}, versao: 1 };
try {
  index = JSON.parse(fs.readFileSync(indexPath, "utf8") || "{}");
  if (!index || typeof index !== "object") index = { usuarios: {}, versao: 1 };
  if (!index.usuarios || typeof index.usuarios !== "object") index.usuarios = {};
} catch {
  index = { usuarios: {}, versao: 1 };
}

index.usuarios[emailHash] = {
  ...(index.usuarios[emailHash] || {}),
  emailHash,
  idioma: "pt-BR",
  roles,
  ativo: true,
  ultimoLoginISO: null,
  updatedAt: nowISO,
};

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");

console.log(JSON.stringify({ ok: true, home, email, emailHash, userPath, indexPath, roles }, null, 2));

