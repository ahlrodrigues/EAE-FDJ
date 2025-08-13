// === ./main.js ===============================================================
// 📦 Módulos do Electron e Node.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");

const { isLoginAtivo } = require("./backend/lib/sessionStore");

// 🧭 Logs de diagnóstico de preload
console.log("🧭 Caminho real do preload:", path.join(__dirname, "preload.js"));

// 📁 Caminho do arquivo de usuário
const usuarioPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

let janelaCadastro = null; // 🔑 Janela principal do app (mantido nome usado em outros módulos)

// 🧩 Handlers de funcionalidades (caminhos explícitos)
const { registrarCadastroHandler } = require("./backend/handlers/cadastroHandler");
const registrarLoginHandler = require("./backend/handlers/loginHandler");
const registrarBlogHandler = require("./backend/handlers/blogHandler");
const { registrarRedefinirSenhaHandler } = require("./backend/handlers/redefinirSenhaHandler");
const { registrarSolicitarTokenHandler } = require("./backend/handlers/solicitarTokenHandler");
const { registrarVerificacaoEmailHandler } = require("./backend/handlers/verificacaoEmailHandler");
const { registrarUsuarioHandler } = require("./backend/handlers/usuarioHandler");
const { registrarDescriptografarHandler } = require("./backend/handlers/descriptografarHandler");
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

// ✅ Registro de todos os handlers de IPC
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
  registrarNotasHandler(ipcMain);
  registrarLerArquivoHandler();
  registrarSessionHandler();
  registrarRevistaHandler();
  registrarTemasHandler(ipcMain);
  registrarSalvarUsuarioHandler();
  registrarSalvarAceiteHandler(ipcMain);
  registrarAbrirJanelaTermoHandler();
  registrarLerTermoMarkdownHandler(ipcMain);
  // Mantém a dependência de janela: passa um getter que retorna a janela atual
  registrarTermoAceitoHandler(() => janelaCadastro);

  console.log("✅ Todos os handlers registrados com sucesso.");
} catch (e) {
  console.error("❌ Falha ao registrar handlers:", e);
}

// 🛠️ Caminho do preload
const preloadPath = path.join(__dirname, "preload.js");
console.log("📦 Caminho absoluto do preload:", preloadPath);
console.log("📄 Preload existe?", fs.existsSync(preloadPath));

// 🔐 Função utilitária para bloquear o app (voltar ao login)
function bloquearApp(motivo = "desconhecido") {
  if (!janelaCadastro) {
    console.warn("⚠️ bloquearApp chamado sem janela ativa.");
    return;
  }
  console.log(`🔒 Bloqueando app (motivo: ${motivo}). Redirecionando para login...`);
  try {
    // Caminho explícito para o arquivo de login no frontend
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

  // 🔔 Listeners dependentes da janela DEVEM ser registrados após a criação
  // ⛔ Bloqueio se minimizado
  janelaCadastro.on("minimize", () => {
    console.log("🛑 Janela minimizada — acionando bloqueio.");
    bloquearApp("minimize");
  });

  // (Opcional) Bloquear quando a janela perde foco/é ocultada
  // janelaCadastro.on("blur", () => bloquearApp("blur"));
  // janelaCadastro.on("hide", () => bloquearApp("hide"));

  // 🚦 Roteamento inicial: cadastro, login ou index
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

// 🚀 Inicialização do app
app.whenReady().then(() => {
  console.log("⚙️ App pronto. Inicializando...");
  createWindow();

  // 📕 Checagem em segundo plano da capa da revista
  try {
    verificarAtualizacaoCapaEmSegundoPlano();
  } catch (err) {
    console.error("❌ Erro na verificação da capa em segundo plano:", err);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log("🪟 Reabrindo janela após ativação...");
      createWindow();
    }
  });
});

// ⛔ Encerramento do app
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    console.log("🛑 Todas as janelas fechadas. Encerrando app...");
    app.quit();
  }
});

// 🔗 IPC para bloqueio solicitado pelo renderer (inatividade etc.)
ipcMain.on("bloquear-app", (_evt, motivo = "ipc-renderer") => {
  console.log("📨 IPC: bloquear-app recebido. Motivo:", motivo);
  bloquearApp(motivo);
});
