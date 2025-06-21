// 📦 Módulos do Electron e Node.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// 📁 Caminho do arquivo de usuário
const usuarioPath = path.resolve(process.cwd(), "config/usuario.json");

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

// ✅ Registra todos os handlers de IPC
console.log("🔧 Registrando handlers de backend...");
registrarCadastroHandler(ipcMain);
registrarLoginHandler(ipcMain);
registrarBlogHandler(ipcMain);
registrarRedefinirSenhaHandler(ipcMain);
registrarSolicitarTokenHandler(ipcMain);
registrarVerificacaoEmailHandler(ipcMain);
registrarUsuarioHandler(); // Este não requer ipcMain explicitamente
registrarDescriptografarHandler(); // Também não usa ipcMain diretamente
registrarNotasHandler(ipcMain);
registrarLerArquivoHandler();
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

  console.log("🌐 Carregando frontend/login.html com preload ativo...");
  mainWindow.loadFile("frontend/login.html");
}

// 🚀 Inicialização do app
app.whenReady().then(() => {
  console.log("⚙️ App pronto. Inicializando...");
  createWindow();

  // No macOS, reabre a janela se não houver nenhuma aberta
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log("🪟 Reabrindo janela após ativação...");
      createWindow();
    }
  });
});

// ⛔ Encerramento do app (exceto no macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    console.log("🛑 Todas as janelas fechadas. Encerrando app...");
    app.quit();
  }
});
