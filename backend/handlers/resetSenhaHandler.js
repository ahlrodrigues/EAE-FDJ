// =============================================================================
// Caminho: backend/handlers/resetSenhaHandler.js
// Objetivo: Fluxo "esqueci a senha" SEM LEGADO (usuario.json):
//  - IPC "solicitar-token": gera token de reset, salva apenas o HASH + expiração.
//  - IPC "redefinir-senha": valida token, troca senha (bcrypt) e limpa o estado.
// Segurança:
//  - NUNCA loga token ou senha.
//  - Respostas genéricas (não revelam se e-mail existe).
//  - Rate-limit por tentativas (pwReset.attempts).
// =============================================================================

let ipcMain;
try { ({ ipcMain } = require("electron")); } catch { ipcMain = null; } // Node puro: sem Electron

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

const {
  loadUserByHash,
  saveUserByHash,
  getUserFilePath,
  upsertIndexEntry,
} = require("../lib/usuarioStore");

const LOG = "[RESET]";
const TTL_MIN = Number(process.env.RESET_TOKEN_TTL_MIN || 15);          // minutos
const MAX_ATTEMPTS = Number(process.env.RESET_TOKEN_MAX_ATTEMPTS || 5);
const ALLOW_DEV_TOKEN_RETURN = String(process.env.ALLOW_DEV_TOKEN_RETURN || "false").toLowerCase() === "true";

// Helpers
function emailToHash(email) {
  const norm = String(email || "").trim().toLowerCase();
  if (!norm.includes("@")) return null;
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}
function maskEmail(email) {
  try { const [u,d]=String(email).split("@"); return `${u.slice(0,1)}***@${d}`; }
  catch { return "***"; }
}
function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}
function nowISO() { return new Date().toISOString(); }
function addMinutes(date, m) { return new Date(date.getTime() + m*60000); }

// Núcleo: solicitar token (usável em Node/CLI)
async function solicitarTokenCore(email) {
  const masked = maskEmail(email);
  const ts = nowISO();
  if (!email || !email.includes("@")) {
    console.warn(`${LOG} ⚠️ solicitarToken: email inválido`);
    // Resposta genérica (não revela existência)
    return { sucesso: true, mensagem: "Se existir, enviaremos um token." };
  }

  const emailHash = emailToHash(email);
  const user = await loadUserByHash(emailHash);
  if (!user) {
    console.info(`${LOG} ▶ ${ts} solicitarToken: user inexistente email=${masked} hash=${emailHash?.slice(0,8)}…`);
    // Resposta genérica (não revela existência)
    return { sucesso: true, mensagem: "Se existir, enviaremos um token." };
  }

  // Gera token aleatório (32 bytes → hex 64 chars)
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const exp = addMinutes(new Date(), TTL_MIN).toISOString();

  user.pwReset = {
    tokenHash,
    expiresAtISO: exp,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    issuedAtISO: ts
  };
  user.updatedAt = ts;
  user.versao = typeof user.versao === "number" ? user.versao + 1 : 1;

  await saveUserByHash(emailHash, user);
  console.info(`${LOG} ✅ token gerado para hash=${emailHash.slice(0,8)}… file=${getUserFilePath(emailHash)}`);

  // Produção: enviar por e-mail. Aqui: opcionalmente retornar para DEV.
  const payload = { sucesso: true, mensagem: "Se existir, enviaremos um token." };
  if (ALLOW_DEV_TOKEN_RETURN) payload.tokenDev = token; // ⚠️ DEV ONLY
  return payload;
}

// Núcleo: redefinir senha (usável em Node/CLI)
async function redefinirSenhaCore(email, token, novaSenha) {
  const masked = maskEmail(email);
  const ts = nowISO();
  if (!email || !token || !novaSenha) return { sucesso: false, erro: "Dados insuficientes." };

  const emailHash = emailToHash(email);
  const user = await loadUserByHash(emailHash);
  if (!user || !user.pwReset) {
    console.warn(`${LOG} ❌ redefinir: user/pwReset ausente (hash=${emailHash?.slice(0,8)}…)`);
    return { sucesso: false, erro: "Token inválido ou expirado." };
  }

  const pr = user.pwReset;
  // Expiração
  if (!pr.expiresAtISO || new Date(pr.expiresAtISO) < new Date()) {
    console.warn(`${LOG} ❌ redefinir: token expirado (hash=${emailHash.slice(0,8)}…)`);
    return { sucesso: false, erro: "Token inválido ou expirado." };
  }
  // Tentativas
  if (typeof pr.attempts === "number" && typeof pr.maxAttempts === "number" && pr.attempts >= pr.maxAttempts) {
    console.warn(`${LOG} ❌ redefinir: max attempts atingido (hash=${emailHash.slice(0,8)}…)`);
    return { sucesso: false, erro: "Muitas tentativas. Solicite um novo token." };
  }
  // Confere hash do token
  const ok = pr.tokenHash && pr.tokenHash === sha256Hex(token);
  if (!ok) {
    user.pwReset.attempts = (user.pwReset.attempts || 0) + 1;
    await saveUserByHash(emailHash, user);
    console.warn(`${LOG} 🔒 redefinir: token inválido (attempts=${user.pwReset.attempts}/${user.pwReset.maxAttempts})`);
    return { sucesso: false, erro: "Token inválido ou expirado." };
  }

  // Troca de senha
  if (typeof novaSenha !== "string" || novaSenha.length < 4) {
    return { sucesso: false, erro: "Senha muito curta." };
  }
  const novaHash = await bcrypt.hash(novaSenha, 10);
  user.senhaCriptografada = novaHash;
  delete user.pwReset;
  user.updatedAt = ts;
  user.versao = typeof user.versao === "number" ? user.versao + 1 : 1;
  await saveUserByHash(emailHash, user);

  // Opcional: marcar atividade no índice
  await upsertIndexEntry({ emailHash, ultimoLoginISO: ts, ativo: true });

  console.info(`${LOG} ✅ senha redefinida para hash=${emailHash.slice(0,8)}…`);
  return { sucesso: true };
}

// IPC
function registrarResetSenhaHandler(providedIpcMain) {
  const ipc = providedIpcMain || ipcMain;
  if (!ipc || typeof ipc.handle !== "function") {
    console.warn(`${LOG} ⚠️ IPC indisponível (fora do Electron main). Registro ignorado.`);
    return false;
  }

  ipc.handle("solicitar-token", async (_e, email) => {
    try { return await solicitarTokenCore(email); }
    catch (err) {
      console.error(`${LOG} ❌ solicitar-token: ${err.message}`);
      return { sucesso: true, mensagem: "Se existir, enviaremos um token." }; // resposta genérica
    }
  });

  ipc.handle("redefinir-senha", async (_e, email, token, novaSenha) => {
    try { return await redefinirSenhaCore(email, token, novaSenha); }
    catch (err) {
      console.error(`${LOG} ❌ redefinir-senha: ${err.message}`);
      return { sucesso: false, erro: "Erro ao redefinir senha." };
    }
  });

  console.info(`${LOG} 🧩 IPC 'solicitar-token' e 'redefinir-senha' registrados.`);
  return true;
}

module.exports = { registrarResetSenhaHandler, solicitarTokenCore, redefinirSenhaCore };
