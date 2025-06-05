const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require("fs");
const usuarioPath = path.resolve(process.cwd(), 'config/usuario.json');

// Handlers
const { registrarCadastroHandler } = require("./backend/handlers/cadastroHandler");
const registrarLoginHandler = require('./backend/handlers/loginHandler');
const registrarBlogHandler = require('./backend/handlers/blogHandler');
const { registrarRedefinirSenhaHandler } = require("./backend/handlers/redefinirSenhaHandler");
const { registrarSolicitarTokenHandler } = require("./backend/handlers/solicitarTokenHandler");
const { registrarVerificacaoEmailHandler } = require("./backend/handlers/verificacaoEmailHandler");
const { registrarUsuarioHandler } = require("./backend/handlers/usuarioHandler");






// Registra os handlers de IPC
registrarCadastroHandler(ipcMain);
registrarLoginHandler(ipcMain);
registrarBlogHandler(ipcMain);
registrarRedefinirSenhaHandler(ipcMain);
registrarSolicitarTokenHandler(ipcMain);
registrarVerificacaoEmailHandler(ipcMain);
registrarUsuarioHandler();

const preloadPath = path.join(__dirname, 'preload.js');
console.log("🧪 Caminho absoluto do preload:", preloadPath);
console.log("🧪 Arquivo existe?", fs.existsSync(preloadPath));

// Função para criar a janela principal
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, "assets", "icon.png"),
      webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: false,
    },
  });

  console.log("📂 Carregando login.html com preload ativo");
  mainWindow.loadFile('frontend/login.html');
}

// Executado quando o app estiver pronto
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Fecha o app quando todas as janelas forem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

