// === ./main.js ===============================================================
// ⚙️ Ambiente
require("dotenv").config();

// 📦 Electron / Node
const { app, BrowserWindow, ipcMain, shell } = require("electron"); // ⬅️ inclui shell
const path = require("path");
const fs = require("fs");

// 🧬 Sessão
const { isLoginAtivo } = require("./backend/lib/sessionStore");

// 🧭 Preload
const preloadPath = path.join(__dirname, "preload.js");
console.log("🧭 Caminho real do preload:", preloadPath);

// 🗂️ usuario.json (config principal)
const usuarioPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

// 🪟 janela principal
let janelaCadastro = null;

// 🧩 Handlers (IMPORTAR NO TOPO; não redefinir aqui)
const { registrarCadastroHandler } = require("./backend/handlers/cadastroHandler");
const registrarLoginHandler = require("./backend/handlers/loginHandler");
const registrarBlogHandler = require("./backend/handlers/blogHandler");
const { registrarRedefinirSenhaHandler } = require("./backend/handlers/redefinirSenhaHandler");
const { registrarSolicitarTokenHandler } = require("./backend/handlers/solicitarTokenHandler");
const { registrarVerificacaoEmailHandler } = require("./backend/handlers/verificacaoEmailHandler");
const { registrarUsuarioHandler } = require("./backend/handlers/usuarioHandler");
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

// ▶️ Executor do backup (reutilizado pelo cron)
async function executarBackupAgendado() {
  try {
    console.log("▶️ [backupSchedule] Execução agendada iniciada…");

    // Tenta usar executor dedicado, se houver
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

    // Caminho alternativo (simples): enviar diretórios padrão para Google Drive
    const { carregarUsuarioJsonSeguro, descriptografarCampo, salvarUsuarioJsonSeguro } =
      require("./backend/lib/usuarioStore");
    const { GoogleDriveClient } = require("./backend/lib/googleDriveClient");

    const cfgAll = await carregarUsuarioJsonSeguro();
    const bkp = cfgAll?.backup || {};
    if (bkp.servico !== "google-drive" || !bkp.oauthTokenEnc) {
      console.log("ℹ️ [backupSchedule] Serviço não configurado para execução.");
      return;
    }

    const token = JSON.parse(descriptografarCampo(bkp.oauthTokenEnc));
    const drive = new GoogleDriveClient(token);

    const home = process.env.HOME || process.env.USERPROFILE;
    const notasDir = path.join(home, ".config", "escola-aprendizes", "notas");
    const temasDir = path.join(home, ".config", "escola-aprendizes", "temas");

    const enviarDir = async (dir) => {
      if (!fs.existsSync(dir)) return 0;
      let count = 0;
      for (const entry of fs.readdirSync(dir)) {
        const p = path.join(dir, entry);
        if (fs.statSync(p).isFile()) {
          try {
            if (await drive.enviarIncremental(bkp.pastaRemota, p)) count++;
          } catch (e) {
            console.warn("⚠️ [backupSchedule] Falha ao enviar arquivo:", p, e?.message || e);
          }
        }
      }
      return count;
    };

    const enviados = (await enviarDir(notasDir)) + (await enviarDir(temasDir));
    cfgAll.backup.ultimoBackupISO = new Date().toISOString();
    await salvarUsuarioJsonSeguro(cfgAll);
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

  // Abre qualquer window.open/target=_blank em navegador externo
  wc.setWindowOpenHandler(({ url }) => {
    console.log(`${NAV} target=_blank → externo:`, url);
    shell.openExternal(url).catch((err) =>
      console.error(`${NAV} Falha ao abrir (target=_blank):`, err?.message || err)
    );
    return { action: "deny" };
  });

  // Impede navegação para http/https dentro da janela: abre externamente
  wc.on("will-navigate", (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      console.log(`${NAV} will-navigate bloqueado → externo:`, url);
      shell.openExternal(url).catch((err) =>
        console.error(`${NAV} Falha ao abrir (will-navigate):`, err?.message || err)
      );
    }
  });

  // Compat (Electron < 14) — se disparar, também envia para fora
  wc.on("new-window", (event, url) => {
    event.preventDefault();
    console.log(`${NAV} new-window → externo:`, url);
    shell.openExternal(url).catch((err) =>
      console.error(`${NAV} Falha ao abrir (new-window):`, err?.message || err)
    );
  });
}

// 🪟 Criação da janela principal
function createWindow() {
  console.log("🪟 Criando janela principal...");

  janelaCadastro = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // ⛔ Sempre forçar links externos no navegador padrão
  forceExternalBrowserHandlers(janelaCadastro);

  // Eventos de janela
  janelaCadastro.on("minimize", () => {
    console.log("🛑 Janela minimizada — acionando bloqueio.");
    bloquearApp("minimize");
  });

  // 🚦 Roteamento inicial
  try {
    if (!fs.existsSync(usuarioPath)) {
      console.warn("📂 usuario.json não encontrado. Redirecionando para cadastro.");
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

// 🔧 Helper para não deixar um erro travar todos os registros
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
  // Demais handlers (cada um isolado, não param o fluxo)
  safeRegister("cadastroHandler", registrarCadastroHandler, ipcMain);
  safeRegister("loginHandler", registrarLoginHandler, ipcMain);
  safeRegister("blogHandler", registrarBlogHandler, ipcMain);
  safeRegister("redefinirSenhaHandler", registrarRedefinirSenhaHandler, ipcMain);
  safeRegister("solicitarTokenHandler", registrarSolicitarTokenHandler, ipcMain);
  safeRegister("verificacaoEmailHandler", registrarVerificacaoEmailHandler, ipcMain);
  safeRegister("usuarioHandler", registrarUsuarioHandler);
  safeRegister("descriptografarHandler", registrarDescriptografarHandler);
  safeRegister("criptografarHandler", registrarCriptografarHandler);
  safeRegister("notasHandler", registrarNotasHandler, ipcMain);
  safeRegister("lerArquivoHandler", registrarLerArquivoHandler);
  safeRegister("sessionHandler", registrarSessionHandler);
  safeRegister("revistaHandler", registrarRevistaHandler);
  safeRegister("temasHandler", registrarTemasHandler, ipcMain);
  safeRegister("salvarUsuarioHandler", registrarSalvarUsuarioHandler);
  safeRegister("salvarAceiteHandler", registrarSalvarAceiteHandler, ipcMain);
  safeRegister("abrirJanelaTermoHandler", registrarAbrirJanelaTermoHandler);
  safeRegister("lerTermoMarkdownHandler", registrarLerTermoMarkdownHandler, ipcMain);
  safeRegister("termoAceitoHandler", registrarTermoAceitoHandler, () => janelaCadastro);

  safeRegister("backupEmailHandler", registrarBackupEmailHandler);

  // ⚠️ shellHandler estava quebrando o boot — registre só se exporta função
  if (typeof registrarShellHandler === "function") {
    safeRegister("shellHandler", registrarShellHandler);
  } else {
    console.warn("⚠️ [REG] registrarShellHandler não é função (verifique export em ./backend/handlers/shellHandler).");
  }

  // Agendadores e backup geral
  safeRegister("backupScheduleIeHandler", registrarBackupScheduleIeHandler, { startSchedule, stopSchedule, executarBackupAgendado });
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

  // 📕 Capa da revista em segundo plano
  try {
    verificarAtualizacaoCapaEmSegundoPlano();
  } catch (err) {
    console.error("❌ Erro na verificação da capa em segundo plano:", err);
  }

  // ⏰ Agendar backup no startup, se configurado
  if (startSchedule) {
    try {
      const raw = fs.existsSync(usuarioPath) ? fs.readFileSync(usuarioPath, "utf-8") : null;
      const cfg = raw ? JSON.parse(raw) : {};
      const b = cfg?.backup || {};
      if (b.modo === "agendado") {
        const hhmm = b.horario || "22:30";
        console.log("⏰ Config detectada: agendado diário às", hhmm);
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
