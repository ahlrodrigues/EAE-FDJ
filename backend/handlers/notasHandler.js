// ============================================================================
// Caminho: backend/handlers/notasHandler.js
// Responsabilidade: IPC para Salvar/Listar/Ler/Excluir anotações
// Requisitos:
//  - Conteúdo criptografado como BLOCO ÚNICO (AES-256-GCM)
//  - Base: ~/.config/escola-aprendizes/notas/<emailHash>/
//  - Nome do arquivo: YYYY-MM-DD-HH-MM-SS_nome.txt (recebido do renderer)
// Logs: 🧠[MAIN][NOTAS]
// ============================================================================
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const LOG = "🧠[MAIN][NOTAS]";
const NOTAS_BASE = path.join(os.homedir(), ".config", "escola-aprendizes", "notas");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET || process.env.APP_MASTER_KEY || "";

// --- Util: validações & paths ------------------------------------------------
function safeJoinNotas(emailHash, nomeArquivo) {
  const eh = String(emailHash || "").trim();
  if (!eh || !/^[a-f0-9]{64}$/i.test(eh)) throw new Error("emailHash inválido");

  // evita path traversal
  const base = path.join(NOTAS_BASE, eh);
  const alvo = path.join(base, path.basename(nomeArquivo || ""));
  if (!alvo.startsWith(base)) throw new Error("Caminho inválido");
  return { base, alvo };
}

function isTxt(nomeArquivo) {
  return typeof nomeArquivo === "string" && nomeArquivo.endsWith(".txt");
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

// --- Util: criptografia AES-256-GCM -----------------------------------------
// Formato salvo: base64("iv(12b) | tag(16b) | cipher(...)")
function kdf(secret) {
  if (!secret) throw new Error("CRYPTO_SECRET ausente");
  return crypto.createHash("sha256").update(String(secret), "utf8").digest(); // 32 bytes
}
function cifrar(plaintext, secret) {
  const key = kdf(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
function decifrar(payloadB64, secret) {
  const key = kdf(secret);
  const buf = Buffer.from(String(payloadB64), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

// --- Handlers ---------------------------------------------------------------
function registrarNotasHandler(ipcMain) {
  if (!ipcMain) throw new Error("ipcMain requerido em registrarNotasHandler");

  // Salvar
  ipcMain.handle("notas:salvar", async (_evt, { emailHash, nomeArquivo, conteudo }) => {
    try {
      console.log(`${LOG} notas:salvar recebido`, { emailHash: !!emailHash, nomeArquivo });
      if (!isTxt(nomeArquivo)) throw new Error("nomeArquivo inválido (esperado .txt)");

      const { base, alvo } = safeJoinNotas(emailHash, nomeArquivo);
      await ensureDir(base);

      const cifrado = cifrar(conteudo, CRYPTO_SECRET);
      await fsp.writeFile(alvo, cifrado, "utf8");

      console.log(`${LOG} ✔ salvo: ${alvo}`);
      return { sucesso: true, caminho: alvo };
    } catch (e) {
      console.error(`${LOG} ✖ erro em notas:salvar:`, e.message);
      return { sucesso: false, erro: e.message };
    }
  });

  // Listar
  ipcMain.handle("notas:listar", async (_evt, { emailHash }) => {
    try {
      const { base } = safeJoinNotas(emailHash, "dummy.txt");
      await ensureDir(base);
      const itens = await fsp.readdir(base, { withFileTypes: true });
      const arquivos = itens
        .filter((d) => d.isFile() && d.name.endsWith(".txt"))
        .map((d) => d.name)
        // ordena por data no nome (desc): YYYY-MM-DD-HH-MM-SS_nome.txt
        .sort((a, b) => (a < b ? 1 : -1));
      return { ok: true, arquivos };
    } catch (e) {
      console.error(`${LOG} ✖ erro em notas:listar:`, e.message);
      return { ok: false, erro: e.message, arquivos: [] };
    }
  });

  // Ler (descriptografar)
  ipcMain.handle("notas:ler", async (_evt, { emailHash, nomeArquivo }) => {
    try {
      if (!isTxt(nomeArquivo)) throw new Error("nomeArquivo inválido");
      const { alvo } = safeJoinNotas(emailHash, nomeArquivo);
      const b64 = await fsp.readFile(alvo, "utf8");
      const texto = decifrar(b64, CRYPTO_SECRET);
      return { ok: true, conteudo: texto };
    } catch (e) {
      console.error(`${LOG} ✖ erro em notas:ler:`, e.message);
      return { ok: false, erro: e.message };
    }
  });

  // Excluir
  ipcMain.handle("notas:excluir", async (_evt, { emailHash, nomeArquivo }) => {
    try {
      if (!isTxt(nomeArquivo)) throw new Error("nomeArquivo inválido");
      const { alvo } = safeJoinNotas(emailHash, nomeArquivo);
      await fsp.unlink(alvo);
      console.log(`${LOG} 🗑️ excluído: ${alvo}`);
      return { ok: true };
    } catch (e) {
      console.error(`${LOG} ✖ erro em notas:excluir:`, e.message);
      return { ok: false, erro: e.message };
    }
  });

  console.log(`${LOG} Registrados handlers: notas:salvar/listar/ler/excluir`);
}

module.exports = { registrarNotasHandler };
