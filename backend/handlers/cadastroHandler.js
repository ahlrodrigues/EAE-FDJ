// =============================================================================
// Caminho: backend/handlers/cadastroHandler.js
// Objetivo:
//   - Registrar/atualizar cadastro de usuário em:
//       ~/.config/escola-aprendizes/config/usuarios/<emailHash>.json
//     e atualizar:
//       ~/.config/escola-aprendizes/config/index.json
//   - Criptografar campos sensíveis com CRYPTO_SECRET (via ../lib/criptografia).
//   - Funcionar tanto no Electron (IPC) quanto em CLI/testes (Node puro).
//   - Normalizar idioma → "pt-BR" por padrão (BCP 47, região em maiúsculas).
// Logs: prefixo [CADASTRO]
// =============================================================================

let ipcMain;
try { ({ ipcMain } = require("electron")); } catch { ipcMain = null; } // Node puro: sem Electron

const dotenv = require("dotenv");
dotenv.config(); // seguro de chamar; útil em CLI/tests

const bcrypt = require("bcryptjs");

const {
  criptografarComMestra,
  criptografarCamposUsuario,
} = require("../lib/criptografia");

const {
  getUserFilePath,
  saveUserByHash,
  loadUserByHash,
  upsertIndexEntry,
} = require("../lib/usuarioStore");

const LOG = "[CADASTRO]";
const CHAVE_MESTRA = process.env.CRYPTO_SECRET;

function isValidHash(h) {
  // sha256 em hex (64 chars). Ajuste se seu hash tiver outro formato.
  return typeof h === "string" && /^[a-f0-9]{64}$/i.test(h);
}
function safeKeys(obj) {
  try { return Object.keys(obj || {}).slice(0, 20); } catch { return []; }
}

// 🌐 Normalização de idioma → tag BCP 47 com região em MAIÚSCULAS (default pt-BR)
function normalizeIdiomaTag(input) {
  const raw = String(input || "").trim();
  if (!raw) return "pt-BR";
  const s = raw.replace("_", "-").toLowerCase();
  const map = {
    "pt": "pt-BR",
    "pt-br": "pt-BR",
    "ptbr": "pt-BR",
    "en": "en-US",
    "en-us": "en-US",
    "enus": "en-US",
    "es": "es-ES",
    "es-es": "es-ES",
    "eses": "es-ES",
  };
  const normalized = map[s] || s;
  if (/^[a-z]{2}(-[a-z]{2})$/.test(normalized)) {
    const [lang, region] = normalized.split("-");
    return `${lang.toLowerCase()}-${region.toUpperCase()}`;
  }
  return "pt-BR";
}

// -----------------------------------------------------------------------------
// 🧠 Núcleo de negócio (puro, sem Electron): testável em Node/CLI
// -----------------------------------------------------------------------------
async function salvarCadastroCore(dadosInput) {
  const ts = new Date().toISOString();
  if (!dadosInput || typeof dadosInput !== "object") throw new Error("Payload inválido");

  const dados = { ...dadosInput }; // não mutar o original
  console.info(`${LOG} ▶ core: recebidos campos=${safeKeys(dados).join(", ")} @ ${ts}`);

  if (!dados.emailHash) throw new Error("Campo 'emailHash' ausente");
  if (!isValidHash(dados.emailHash)) throw new Error("emailHash inválido (sha256 hex esperado)");
  if (!CHAVE_MESTRA) throw new Error("CRYPTO_SECRET ausente no ambiente");

  const emailHash = dados.emailHash;

  // Perfis/roles
  // Produção: roles devem ser emitidas/assinadas pelo servidor (não escolhidas no cliente).
  // DEV: permitir override somente se habilitado por env.
  const allowLocalRolePick = String(process.env.LOCAL_ALLOW_ROLE_PICK || "").trim() === "1";
  if (!allowLocalRolePick) {
    dados.roles = ["aluno"];
  } else {
    if (!Array.isArray(dados.roles) || dados.roles.length === 0) dados.roles = ["aluno"];
    const allowed = new Set(["aluno", "dirigente", "analista"]);
    dados.roles = Array.from(
      new Set(dados.roles.map((x) => String(x || "").trim().toLowerCase()).filter((x) => allowed.has(x)))
    );
    if (dados.roles.length === 0) dados.roles = ["aluno"];
  }

  // Senha → bcrypt
  if (typeof dados.senha !== "string" || dados.senha.length < 4) {
    throw new Error("Senha ausente ou muito curta");
  }
  const senhaCriptografada = await bcrypt.hash(dados.senha, 10);
  delete dados.senha;

  // E-mail → criptografado com a chave mestra
  if (typeof dados.email === "string" && dados.email.includes("@")) {
    dados.emailCriptografado = criptografarComMestra(dados.email, CHAVE_MESTRA);
    delete dados.email;
  } else {
    delete dados.email; // não persistir lixo
  }

  // 🌐 Idioma normalizado (default: pt-BR)
  const idioma = normalizeIdiomaTag(dados.idioma || "pt-BR");
  console.info(`${LOG} 🌐 idioma normalizado → ${idioma}`);

  // Demais campos sensíveis → usar sua lib (que deve ignorar os já cifrados)
  const dadosBase = {
    ...dados,
    senhaCriptografada,
    idioma, // garantir persistência do idioma já normalizado
  };
  const dadosCriptografados = await criptografarCamposUsuario(dadosBase, CHAVE_MESTRA);

  // Merge com existente e metadados
  const existente = await loadUserByHash(emailHash);
  const nowISO = new Date().toISOString();
  const registro = {
    ...((existente && typeof existente === "object") ? existente : {}),
    ...dadosCriptografados,
    updatedAt: nowISO,
    createdAt: existente?.createdAt || nowISO,
    versao: typeof existente?.versao === "number" ? existente.versao + 1 : 1,
    idioma, // reforço: deixa claro no topo do JSON
  };

  // Persistir arquivo por usuário
  const filePath = getUserFilePath(emailHash);
  await saveUserByHash(emailHash, registro);

  // Atualizar índice leve (sem sensíveis)
  await upsertIndexEntry({
    emailHash,
    idioma,
    roles: Array.isArray(dados.roles) ? dados.roles.slice(0, 8) : undefined,
    ativo: true,
    ultimoLoginISO: nowISO, // aqui como "ultima atualização de cadastro"
  });

  console.info(`${LOG} ✅ core: ${existente ? "atualizado" : "criado"} ${emailHash} → ${filePath}`);

  return { sucesso: true, emailHash, filePath, atualizado: !!existente };
}

// -----------------------------------------------------------------------------
// 🔌 Registro do IPC (Electron main). Em Node puro, apenas avisa e sai.
// -----------------------------------------------------------------------------
function registrarCadastroHandler(providedIpcMain) {
  const ipc = providedIpcMain || ipcMain;
  if (!ipc || typeof ipc.handle !== "function") {
    console.warn(`${LOG} ⚠️ IPC indisponível (fora do processo Electron main). Registro ignorado.`);
    return false;
  }

  ipc.handle("salvar-cadastro", async (_event, dados) => {
    try {
      const res = await salvarCadastroCore(dados);
      return res;
    } catch (erro) {
      console.error(`${LOG} ❌ IPC salvar-cadastro: ${erro.message}`);
      return { sucesso: false, erro: erro.message };
    }
  });

  console.info(`${LOG} 🧩 IPC 'salvar-cadastro' registrado.`);
  return true;
}

module.exports = { registrarCadastroHandler, salvarCadastroCore };
