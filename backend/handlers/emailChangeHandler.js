// =============================================================================
// Caminho: backend/handlers/emailChangeHandler.js
// Objetivo: Fluxo seguro para troca de e-mail do usuário logado.
// IPCs:
//   - "email:iniciar-troca"  (novoEmail, senhaAtual)
//   - "email:confirmar-troca" (token)
// Regras:
//   • Reautenticar por senha
//   • Gerar token (hash armazenado) com TTL e tentativas limitadas
//   • Migrar JSON do usuário e pastas (notas/temas/configs) de <oldHash> → <newHash>
//   • Atualizar index.json e sessão
// Logs: prefixo [EMAIL-CHANGE]
// =============================================================================

let ipcMain;
try { ({ ipcMain } = require("electron")); } catch { ipcMain = null; }

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

const {
  loadUserByHash,
  saveUserByHash,
  getUserFilePath,
  userFileExists,
  upsertIndexEntry,
  renameUserHash,
} = require("../lib/usuarioStore");

const {
  obterEmailHashAtivo,
  definirSessaoAtiva,
} = require("../lib/sessionStore");

const { criptografarComMestra } = require("../lib/criptografia");

const LOG = "[EMAIL-CHANGE]";
const CHAVE_MESTRA = process.env.CRYPTO_SECRET;
const TTL_MIN = Number(process.env.RESET_TOKEN_TTL_MIN || 30);
const MAX_ATTEMPTS = Number(process.env.RESET_TOKEN_MAX_ATTEMPTS || 5);
const ALLOW_DEV_TOKEN_RETURN = String(process.env.ALLOW_DEV_TOKEN_RETURN || "false").toLowerCase() === "true";

// Helpers
const nowISO = () => new Date().toISOString();
const addMinutes = (date, m) => new Date(date.getTime() + m * 60000);
const sha256Hex = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
const normalizeEmail = (s) => String(s || "").trim().toLowerCase();
const emailToHash = (email) => {
  const n = normalizeEmail(email);
  return n.includes("@") ? sha256Hex(n) : null;
};

// -----------------------------------------------------------------------------
// Inicia a troca: valida senha, gera token, armazena hash/token no JSON atual
// -----------------------------------------------------------------------------
async function iniciarTrocaCore(novoEmail, senhaAtual) {
  const ts = nowISO();
  if (!CHAVE_MESTRA) throw new Error("CRYPTO_SECRET ausente");
  if (!novoEmail || !normalizeEmail(novoEmail).includes("@")) throw new Error("E-mail inválido");
  if (!senhaAtual || String(senhaAtual).length < 4) throw new Error("Senha ausente/curta");

  const oldHash = obterEmailHashAtivo();
  if (!oldHash) throw new Error("Sessão inativa");

  const user = await loadUserByHash(oldHash);
  if (!user) throw new Error("Usuário não encontrado na sessão");
  if (!user.senhaCriptografada) throw new Error("Cadastro inconsistente (sem senha)");

  const senhaOK = await bcrypt.compare(senhaAtual, user.senhaCriptografada);
  if (!senhaOK) throw new Error("Senha incorreta");

  const newEmailNorm = normalizeEmail(novoEmail);
  const newHash = emailToHash(newEmailNorm);
  if (!newHash) throw new Error("E-mail inválido");
  if (userFileExists(newHash)) throw new Error("Já existe um usuário com este e-mail");

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const expISO = addMinutes(new Date(), TTL_MIN).toISOString();

  const newEmailEnc = criptografarComMestra(newEmailNorm, CHAVE_MESTRA);

  user.emailChange = {
    newEmailHash: newHash,
    newEmailEnc,
    tokenHash,
    expiresAtISO: expISO,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    initiatedAtISO: ts,
  };
  user.updatedAt = ts;
  user.versao = typeof user.versao === "number" ? user.versao + 1 : 1;

  await saveUserByHash(oldHash, user);
  console.info(`${LOG} ✅ iniciar: token gerado para oldHash=${oldHash.slice(0,8)}… file=${getUserFilePath(oldHash)}`);

  // Produção: enviar o token para o novo e-mail (SMTP / serviço externo).
  const resp = { sucesso: true, mensagem: "Se existir, enviaremos um código de confirmação." };
  if (ALLOW_DEV_TOKEN_RETURN) resp.tokenDev = token; // DEV ONLY
  return resp;
}

// -----------------------------------------------------------------------------
// Confirma a troca: valida token e migra hash/arquivos/index/sessão
// -----------------------------------------------------------------------------
async function confirmarTrocaCore(token) {
  const ts = nowISO();
  const oldHash = obterEmailHashAtivo();
  if (!oldHash) return { sucesso: false, erro: "Sessão inativa" };
  if (!token) return { sucesso: false, erro: "Token ausente" };

  const user = await loadUserByHash(oldHash);
  if (!user || !user.emailChange) {
    console.warn(`${LOG} ❌ confirmar: emailChange ausente (oldHash=${oldHash.slice(0,8)}…)`);
    return { sucesso: false, erro: "Token inválido ou expirado." };
  }

  const ec = user.emailChange;

  // Expirado?
  if (!ec.expiresAtISO || new Date(ec.expiresAtISO) < new Date()) {
    return { sucesso: false, erro: "Token inválido ou expirado." };
  }
  // Tentativas
  if (typeof ec.attempts === "number" && typeof ec.maxAttempts === "number" && ec.attempts >= ec.maxAttempts) {
    return { sucesso: false, erro: "Muitas tentativas. Inicie novamente." };
  }
  // Confere hash
  const ok = ec.tokenHash && ec.tokenHash === sha256Hex(token);
  if (!ok) {
    user.emailChange.attempts = (user.emailChange.attempts || 0) + 1;
    await saveUserByHash(oldHash, user);
    return { sucesso: false, erro: "Token inválido ou expirado." };
  }

  const newHash = ec.newEmailHash;
  if (userFileExists(newHash)) return { sucesso: false, erro: "E-mail já está em uso." };

  // Prepara novo registro
  const newUserRecord = {
    ...user,
    emailCriptografado: ec.newEmailEnc,
    updatedAt: ts,
    versao: typeof user.versao === "number" ? user.versao + 1 : 1,
    migratedFrom: oldHash,
  };
  delete newUserRecord.emailChange;

  // Migra (json + notas/temas/configs + index)
  const res = await renameUserHash(oldHash, newHash, newUserRecord);
  if (!res?.ok) {
    console.error(`${LOG} ❌ migração falhou:`, res?.erro || "desconhecido");
    return { sucesso: false, erro: res?.erro || "Falha ao concluir troca de e-mail." };
  }

  definirSessaoAtiva(newHash);
  await upsertIndexEntry({ emailHash: newHash, ativo: true, ultimoLoginISO: ts });

  console.info(`${LOG} ✅ concluída: ${oldHash.slice(0,8)}… → ${newHash.slice(0,8)}…`);
  return { sucesso: true, emailHash: newHash };
}

// -----------------------------------------------------------------------------
// Registro IPC
// -----------------------------------------------------------------------------
function registrarEmailChangeHandler(providedIpcMain) {
  const ipc = providedIpcMain || ipcMain;
  if (!ipc || typeof ipc.handle !== "function") {
    console.warn(`${LOG} ⚠️ IPC indisponível (fora do processo Electron main). Registro ignorado.`);
    return false;
  }

  ipc.handle("email:iniciar-troca", async (_e, novoEmail, senhaAtual) => {
    try { return await iniciarTrocaCore(novoEmail, senhaAtual); }
    catch (err) {
      console.error(`${LOG} ❌ iniciar: ${err.message}`);
      // Resposta genérica para não vazar se e-mail existe
      return { sucesso: true, mensagem: "Se existir, enviaremos um código de confirmação." };
    }
  });

  ipc.handle("email:confirmar-troca", async (_e, token) => {
    try { return await confirmarTrocaCore(token); }
    catch (err) {
      console.error(`${LOG} ❌ confirmar: ${err.message}`);
      return { sucesso: false, erro: "Erro ao confirmar troca de e-mail." };
    }
  });

  console.info(`${LOG} 🧩 IPC 'email:iniciar-troca' e 'email:confirmar-troca' registrados.`);
  return true;
}

module.exports = {
  registrarEmailChangeHandler,
  iniciarTrocaCore,
  confirmarTrocaCore,
};
