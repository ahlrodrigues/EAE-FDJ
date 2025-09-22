// === ./main.js ===============================================================
// ⚙️ Ambiente (main pode carregar dotenv; stores/handlers não carregam)
require("dotenv").config();

// 📦 Electron / Node
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// 🧬 Sessão
const { isLoginAtivo, obterEmailHashAtivo } = require("./backend/lib/sessionStore");

// 🧭 Preload (conferência de caminho)
const preloadPath = path.join(__dirname, "preload.js");
console.log("🧭 Caminho real do preload:", preloadPath);

// 🗂️ Caminhos de configuração (NOVO: sem usuario.json legado)
const HOME = process.env.HOME || process.env.USERPROFILE;
const CONFIG_DIR = path.join(HOME, ".config", "escola-aprendizes", "config");
const BACKUP_CFG_PATH = path.join(CONFIG_DIR, "backup.json");   // arquivo global de backup
const USERS_DIR = path.join(CONFIG_DIR, "usuarios");            // pasta por usuário (json por hash)

// 🪟 janela principal
let janelaCadastro = null;

// 🧩 Handlers (importados no topo; sem redefinir aqui)
const { registrarCadastroHandler } = require("./backend/handlers/cadastroHandler");
const registrarBlogHandler = require("./backend/handlers/blogHandler");
const { CHANNELS: BLOG_CHANNELS } = require("./backend/handlers/blogHandler"); // ✅ canais padronizados
const { registrarResetSenhaHandler } = require("./backend/handlers/resetSenhaHandler"); // unificado
const { registrarVerificacaoEmailHandler } = require("./backend/handlers/verificacaoEmailHandler");
const { registrarUsuarioHandler } = require("./backend/handlers/usuarioHandler"); // novo modelo
const { registrarDescriptografarHandler } = require("./backend/handlers/descriptografarHandler");
const { registrarCriptografarHandler } = require("./backend/handlers/criptografarHandler");
const { registrarNotasHandler } = require("./backend/handlers/notasHandler");
const { registrarLerArquivoHandler } = require("./backend/handlers/lerArquivoHandler");
const { registrarSessionHandler } = require("./backend/handlers/sessionHandler");
const { registrarRevistaHandler, verificarAtualizacaoCapaEmSegundoPlano } = require("./backend/handlers/revistaHandler.js");
const { registrarTemasHandler } = require("./backend/handlers/temasHandler");
const { registrarSalvarUsuarioHandler } = require("./backend/handlers/salvarUsuarioHandler");
const { registrarSalvarAceiteHandler } = require("./backend/handlers/salvarAceiteHandler");
const { registrarAbrirJanelaTermoHandler } = require("./backend/handlers/abrirJanelaTermoHandler");
const { registrarLerTermoMarkdownHandler } = require("./backend/handlers/lerTermoMarkdownHandler");
const { registrarTermoAceitoHandler } = require("./backend/handlers/registrarTermoAceitoHandler");
const { registrarBackupHandler } = require("./backend/handlers/backupHandler");
const { startSchedule, stopSchedule } = require("./backend/handlers/backupSchedule");
const { registrarBackupScheduleIeHandler } = require("./backend/handlers/backupScheduleIeHandler");
const { registrarShellHandler } = require("./backend/handlers/shellHandler");
const { registrarBackupEmailHandler } = require("./backend/handlers/backupEmailHandler");
const { registrarLoginHandler } = require("./backend/handlers/loginHandler");
const { registrarEmailChangeHandler } = require("./backend/handlers/emailChangeHandler");

// ▶️ Executor do backup (reutilizado pelo cron)
async function executarBackupAgendado() {
  try {
    console.log("▶️ [backupSchedule] Execução agendada iniciada…");

    // 1) Preferência: executor dedicado, se existir
    try {
      const { execute } = require("./backend/lib/backupRun");
      if (typeof execute === "function") {
        await execute();
        console.log("✅ [backupSchedule] Concluído (via backupRun.execute).");
        return;
      }
      console.warn("⚠️ [backupSchedule] backupRun.execute não é função — usando caminho alternativo.");
    } catch {
      // segue para caminho alternativo
    }

    // 2) Alternativo: ler backup.json GLOBAL (novo modelo)
    if (!fs.existsSync(BACKUP_CFG_PATH)) {
      console.log("ℹ️ [backupSchedule] backup.json não encontrado. Abortando execução simples.");
      return;
    }
    const cfgRaw = fs.readFileSync(BACKUP_CFG_PATH, "utf-8");
    const bkp = JSON.parse(cfgRaw || "{}");

    if (bkp.servico !== "google-drive" || !bkp.oauthTokenEnc) {
      console.log("ℹ️ [backupSchedule] Serviço não configurado para execução.");
      return;
    }

    // 🔓 Token OAuth: AES-GCM (IV=12) com CRYPTO_SECRET — usa helpers do usuarioStore
    const { descriptografarCampo } = require("./backend/lib/usuarioStore");
    const { GoogleDriveClient } = require("./backend/lib/googleDriveClient");

    let token;
    try {
      token = JSON.parse(descriptografarCampo(bkp.oauthTokenEnc));
    } catch (e) {
      console.error("❌ [backupSchedule] Falha ao decifrar oauthTokenEnc de backup.json:", e?.message || e);
      return;
    }

    const drive = new GoogleDriveClient(token);

    // 🔎 Só envia conteúdo do USUÁRIO LOGADO (se houver sessão)
    if (!isLoginAtivo()) {
      console.log("ℹ️ [backupSchedule] Sem sessão ativa — executor simples não enviará nada.");
      return;
    }
    const emailHash = obterEmailHashAtivo();
    const notasDir = path.join(HOME, ".config", "escola-aprendizes", "notas", emailHash);
    const temasDir = path.join(HOME, ".config", "escola-aprendizes", "temas", emailHash);

    const pastaRemota = bkp.pastaRemota || bkp.pastaNome || "EAEbackup";

    const enviarDir = async (dir) => {
      if (!fs.existsSync(dir)) return 0;
      let count = 0;
      for (const entry of fs.readdirSync(dir)) {
        const p = path.join(dir, entry);
        if (fs.statSync(p).isFile()) {
          try {
            if (await drive.enviarIncremental(pastaRemota, p)) count++;
          } catch (e) {
            console.warn("⚠️ [backupSchedule] Falha ao enviar arquivo:", p, e?.message || e);
          }
        }
      }
      return count;
    };

    const enviados = (await enviarDir(notasDir)) + (await enviarDir(temasDir));
    console.log("✅ [backupSchedule] Concluído. Arquivos enviados:", enviados);
  } catch (e) {
    console.error("❌ [backupSchedule] Erro na execução agendada:", e?.message || e);
  }
}

// 🔐 Bloquear app → volta para login
function bloquearApp(motivo = "desconhecido") {
  if (!janelaCadastro) {
    console.warn("⚠️ bloquearApp chamado sem janela ativa.");
    return;
  }
  console.log(`🔒 Bloqueando app (motivo: ${motivo}). Redirecionando para login...`);
  try {
    janelaCadastro.loadFile(path.join(__dirname, "frontend", "login.html"));
  } catch (err) {
    console.error("❌ Erro ao carregar tela de login:", err);
  }
}

// 🌐 Forçar abertura EXTERNA de links (nunca em janela interna)
const NAV = "🌐 [external-nav]";
function forceExternalBrowserHandlers(win) {
  if (!win || win.isDestroyed?.()) return;
  const wc = win.webContents;

  wc.setWindowOpenHandler(({ url }) => {
    console.log(`${NAV} target=_blank → externo:`, url);
    shell.openExternal(url).catch((err) =>
      console.error(`${NAV} Falha ao abrir (target=_blank):`, err?.message || err)
    );
    return { action: "deny" };
  });

  wc.on("will-navigate", (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      console.log(`${NAV} will-navigate bloqueado → externo:`, url);
      shell.openExternal(url).catch((err) =>
        console.error(`${NAV} Falha ao abrir (will-navigate):`, err?.message || err)
      );
    }
  });

  // Compat (Electron < 14)
  wc.on("new-window", (event, url) => {
    event.preventDefault();
    console.log(`${NAV} new-window → externo:`, url);
    shell.openExternal(url).catch((err) =>
      console.error(`${NAV} Falha ao abrir (new-window):`, err?.message || err)
    );
  });
}

// 👥 Verifica se há ao menos UM usuário cadastrado (modelo novo)
function existeQualquerUsuario() {
  try {
    if (!fs.existsSync(USERS_DIR)) return false;
    const files = fs.readdirSync(USERS_DIR).filter((n) => n.endsWith(".json"));
    return files.length > 0;
  } catch {
    return false;
  }
}

// 🪟 Criação da janela principal
function createWindow() {
  console.log("🪟 Criando janela principal...");

  // ✅ Disponibiliza canais do blog para o PRELOAD via env (opcional e seguro)
  //   O preload terá acesso a process.env (node habilitado no preload):
  process.env.BLOG_CHANNELS_JSON = JSON.stringify(BLOG_CHANNELS);

  // Checagem amigável do preload
  if (!fs.existsSync(preloadPath)) {
    console.warn("⚠️ Preload não encontrado em:", preloadPath);
  }

  janelaCadastro = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
      nodeIntegration: false,
      sandbox: false,
      // Você também pode passar argumentos extras se preferir:
      // additionalArguments: [`--blog-channels=${encodeURIComponent(process.env.BLOG_CHANNELS_JSON)}`],
    },
  });

  // ⛔ Sempre forçar links externos no navegador padrão
  forceExternalBrowserHandlers(janelaCadastro);

  // Eventos de janela
  janelaCadastro.on("minimize", () => {
    console.log("🛑 Janela minimizada — acionando bloqueio.");
    bloquearApp("minimize");
  });

  // 🚦 Roteamento inicial (SEM usuario.json)
  try {
    if (!existeQualquerUsuario()) {
      console.warn("👤 Nenhum usuário cadastrado (config/usuarios vazio). Redirecionando para cadastro.");
      janelaCadastro.loadFile(path.join(__dirname, "frontend", "cadastro.html"));
    } else if (!isLoginAtivo()) {
      console.log("🔐 Sessão inativa. Abrindo login.");
      janelaCadastro.loadFile(path.join(__dirname, "frontend", "login.html"));
    } else {
      console.log("✅ Sessão ativa. Abrindo app.");
      janelaCadastro.loadFile(path.join(__dirname, "frontend", "index.html"));
    }
  } catch (err) {
    console.error("❌ Erro ao decidir tela inicial:", err);
    bloquearApp("fallback-erro-inicializacao");
  }
}

// 🔧 Helper para registro tolerante a falhas
function safeRegister(nome, fn, ...args) {
  try {
    if (typeof fn !== "function") {
      console.warn(`⚠️ [REG] ${nome} não é função, pulando.`);
      return;
    }
    fn(...args);
    console.log(`✅ [REG] ${nome} registrado.`);
  } catch (e) {
    console.error(`❌ [REG] Falha ao registrar ${nome}:`, e?.message || e);
  }
}

// ✅ Registro de handlers
console.log("🔧 Registrando handlers de backend (tolerante a falhas)...");
try {
  safeRegister("cadastroHandler", registrarCadastroHandler, ipcMain);
  safeRegister("loginHandler", registrarLoginHandler, ipcMain);
  safeRegister("blogHandler", registrarBlogHandler, ipcMain); // ✅ usa canais padronizados
  safeRegister("resetSenhaHandler", registrarResetSenhaHandler, ipcMain);
  safeRegister("verificacaoEmailHandler", registrarVerificacaoEmailHandler, ipcMain);
  safeRegister("usuarioHandler", registrarUsuarioHandler); // novo modelo (não recebe ipcMain)
  safeRegister("descriptografarHandler", registrarDescriptografarHandler);
  safeRegister("criptografarHandler", registrarCriptografarHandler);
  safeRegister("notasHandler", registrarNotasHandler, ipcMain);
  safeRegister("lerArquivoHandler", registrarLerArquivoHandler);
  safeRegister("sessionHandler", registrarSessionHandler);
  safeRegister("revistaHandler", registrarRevistaHandler, ipcMain);
  safeRegister("temasHandler", registrarTemasHandler, ipcMain);
  safeRegister("salvarUsuarioHandler", registrarSalvarUsuarioHandler);
  safeRegister("salvarAceiteHandler", registrarSalvarAceiteHandler, ipcMain);
  safeRegister("abrirJanelaTermoHandler", registrarAbrirJanelaTermoHandler);
  safeRegister("lerTermoMarkdownHandler", registrarLerTermoMarkdownHandler, ipcMain);
  safeRegister("termoAceitoHandler", registrarTermoAceitoHandler, () => janelaCadastro);
  safeRegister("emailChangeHandler", registrarEmailChangeHandler, ipcMain);
  safeRegister("backupEmailHandler", registrarBackupEmailHandler);

  if (typeof registrarShellHandler === "function") {
    safeRegister("shellHandler", registrarShellHandler);
  } else {
    console.warn("⚠️ [REG] registrarShellHandler não é função (verifique export em ./backend/handlers/shellHandler).");
  }

  safeRegister(
    "backupScheduleIeHandler",
    registrarBackupScheduleIeHandler,
    { startSchedule, stopSchedule, executarBackupAgendado }
  );
  safeRegister("backupHandler", registrarBackupHandler);

  console.log("✅ Todos os handlers registrados (veja logs ✅/❌ por item).");
} catch (e) {
  console.error("❌ Falha inesperada ao registrar handlers:", e);
}

// 🛠️ Conferência do preload
console.log("📦 Caminho absoluto do preload:", preloadPath);
console.log("📄 Preload existe?", fs.existsSync(preloadPath));

// 🚀 Inicialização
app.whenReady().then(async () => {
  console.log("⚙️ App pronto. Inicializando...");
  createWindow();

  // 🩺 Healthcheck/observabilidade — aguarda ping do renderer
  console.log("🩺 [blog] Aguardando ping via canal:", BLOG_CHANNELS?.PING, "(exposto pelo preload).");

  try {
  console.log("📗 [revista] Iniciando verificação de capa em segundo plano (base=531, maxTentativas=30)...");
  await verificarAtualizacaoCapaEmSegundoPlano(); // ← use await para log de término
  console.log("📗 [revista] Verificação de capa finalizada.");
} catch (err) {
  console.error("❌ [revista] Erro na verificação da capa em segundo plano:", err);
}

  // 📕 Capa da revista em segundo plano
  try {
    verificarAtualizacaoCapaEmSegundoPlano();
  } catch (err) {
    console.error("❌ Erro na verificação da capa em segundo plano:", err);
  }

  // ⏰ Agendar backup no startup, se configurado (backup.json global)
  if (startSchedule) {
    try {
      const raw = fs.existsSync(BACKUP_CFG_PATH) ? fs.readFileSync(BACKUP_CFG_PATH, "utf-8") : null;
      const b = raw ? JSON.parse(raw) : {};
      if (b.modo === "agendado") {
        const hhmm = b.horario || "22:30";
        console.log("⏰ Config detectada: agendado diário às", hhmm, "(fonte:", BACKUP_CFG_PATH, ")");
        startSchedule(hhmm, executarBackupAgendado);
      } else {
        console.log("⏹️ Backup não-agendado no startup (modo:", b.modo || "manual", ").");
      }
    } catch (e) {
      console.warn("⚠️ Falha ao configurar agendamento inicial:", e?.message || e);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log("🪟 Reabrindo janela após ativação...");
      createWindow();
    }
  });
});

// ⛔ Encerramento
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    console.log("🛑 Todas as janelas fechadas. Encerrando app...");
    app.quit();
  }
});

// 🔗 IPC utilitário: bloquear por pedido do renderer
ipcMain.on("bloquear-app", (_evt, motivo = "ipc-renderer") => {
  console.log("📨 IPC: bloquear-app recebido. Motivo:", motivo);
  bloquearApp(motivo);
});

// 🌐 IPC utilitário: abrir link no navegador padrão (usado por preload/renderer)
ipcMain.on("abrirLink", (_evt, url) => {
  if (!url) return;
  console.log(`${NAV} IPC abrirLink →`, url);
  shell.openExternal(url).catch((err) =>
    console.error(`${NAV} Falha ao abrir (IPC abrirLink):`, err?.message || err)
  );
});
