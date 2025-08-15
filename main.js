// === ./main.js ===============================================================
// === ./main.js ===============================================================
// ⚙️ Ambiente
require("dotenv").config();

// 📦 Electron / Node
const { app, BrowserWindow, ipcMain } = require("electron");
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

// 🧩 Handlers (IMPORTAR NO TOPO, antes do registro!)
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


// ▶️ Executor do backup (reutilizado pelo cron)
// - Se existir backend/lib/backupRun.js com `execute()`, usamos.
// - Senão, tentamos uma rotina mínima inline (pode ser substituída depois).
async function executarBackupAgendado() {
  try {
    console.log("▶️ [backupSchedule] Execução agendada iniciada…");

    // Tenta usar executor dedicado, se houver
    try {
      const { execute } = require("./backend/lib/backupRun");
      if (typeof execute === "function") {
        await execute(); // ideal: centraliza regras e serviços
        console.log("✅ [backupSchedule] Concluído (via backupRun.execute).");
        return;
      }
      console.warn("⚠️ [backupSchedule] backupRun.execute não é função — usando caminho alternativo.");
    } catch {
      // segue para caminho alternativo
    }

    // Caminho alternativo (simples): enviar diretorios padrão para Google Drive
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

// ✅ Registro de handlers
console.log("🔧 Registrando handlers de backend...");
try {
  registrarCadastroHandler(ipcMain);
  registrarLoginHandler(ipcMain);
  registrarBlogHandler(ipcMain);
  registrarRedefinirSenhaHandler(ipcMain);
  registrarSolicitarTokenHandler(ipcMain);
  registrarVerificacaoEmailHandler(ipcMain);
  registrarUsuarioHandler();
  registrarDescriptografarHandler();
  registrarCriptografarHandler(); // ✅ agora garantido antes do uso
  registrarNotasHandler(ipcMain);
  registrarLerArquivoHandler();
  registrarSessionHandler();
  registrarRevistaHandler();
  registrarTemasHandler(ipcMain);
  registrarSalvarUsuarioHandler();
  registrarSalvarAceiteHandler(ipcMain);
  registrarAbrirJanelaTermoHandler();
  registrarLerTermoMarkdownHandler(ipcMain);
  registrarTermoAceitoHandler(() => janelaCadastro);
  registrarBackupHandler();
  console.log("✅ Todos os handlers registrados com sucesso.");
} catch (e) {
  console.error("❌ Falha ao registrar handlers:", e);
}

// 🛠️ Conferência do preload
console.log("📦 Caminho absoluto do preload:", preloadPath);
console.log("📄 Preload existe?", fs.existsSync(preloadPath));

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

// 🔁 (Opcional) Reagendar sob demanda — ex.: seu handler de salvar backup pode emitir este evento
ipcMain.on("backup:schedule:update", (_evt, hhmm = "22:30") => {
  if (!startSchedule || !stopSchedule) {
    console.warn("⚠️ backup:schedule:update recebido mas scheduler indisponível.");
    return;
  }
  try {
    console.log("🔁 Reagendando backup diário para:", hhmm);
    stopSchedule();
    startSchedule(hhmm, executarBackupAgendado);
  } catch (e) {
    console.error("❌ Falha ao reagendar backup:", e?.message || e);
  }
});
