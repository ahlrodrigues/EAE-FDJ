// 📦 Módulos do Electron e Node.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { isLoginAtivo } = require("./backend/lib/sessionStore");
const fsPromises = require("fs/promises");

// 📁 Caminho do arquivo de usuário
const usuarioPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);


// 🧩 Handlers de funcionalidades
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
const { registrarRevistaHandler, verificarAtualizacaoCapaEmSegundoPlano } = require('./backend/handlers/revistaHandler.js');
const { registrarTemasHandler } = require("./backend/handlers/temasHandler");
const { registrarSalvarUsuarioHandler } = require("./backend/handlers/salvarUsuarioHandler");




// ✅ Registra todos os handlers de IPC
console.log("🔧 Registrando handlers de backend...");
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

app.whenReady().then(() => {
  verificarAtualizacaoCapaEmSegundoPlano();
});

console.log("✅ Todos os handlers registrados com sucesso.");

// 🛠️ Caminho do preload
const preloadPath = path.join(__dirname, "preload.js");
console.log("📦 Caminho absoluto do preload:", preloadPath);
console.log("📄 Preload existe?", fs.existsSync(preloadPath));

// 🪟 Criação da janela principal
function createWindow() {
  console.log("🪟 Criando janela principal...");

  const mainWindow = new BrowserWindow({
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

  if (!fs.existsSync(usuarioPath)) {
    console.warn("📂 usuario.json não encontrado. Redirecionando para cadastro.");
    mainWindow.loadFile("frontend/cadastro.html");
  } else if (!isLoginAtivo()) {
    console.log("🔐 Sessão inativa. Abrindo login.");
    mainWindow.loadFile("frontend/login.html");
  } else {
    console.log("✅ Sessão ativa. Abrindo app.");
    mainWindow.loadFile("frontend/index.html");
  }
}

// 🚀 Inicialização do app
app.whenReady().then(() => {
  console.log("⚙️ App pronto. Inicializando...");
  createWindow();

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



