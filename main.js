// 📦 Módulos do Electron e Node.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { isLoginAtivo } = require("./backend/lib/sessionStore");
const fsPromises = require("fs/promises");

console.log("🧭 Caminho real do preload:", path.join(__dirname, "preload.js"));

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
    
// ✅ Registra UMA VEZ o handler global
ipcMain.handle("abrir-janela-termo", async () => {
  return new Promise((resolve) => {
    const caminhoPreload = path.join(__dirname, "preload-termo.js");
    console.log("📦 Abrindo termo com preload:", caminhoPreload);

    const termoWin = new BrowserWindow({
      width: 800,
      height: 600,
      modal: true,
      parent: BrowserWindow.getFocusedWindow(),
      show: false,
      sandbox: false,
      webPreferences: {
        preload: caminhoPreload,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    termoWin.once("ready-to-show", () => termoWin.show());
    termoWin.loadFile(path.join(__dirname, "frontend", "termo.html"));

    ipcMain.once("termo-aceito", () => {
      resolve(true);
      termoWin.close();
    });

    termoWin.on("closed", () => {
      resolve(false);
    });
  });
});

ipcMain.handle("ler-termo-md", async (event, idioma) => {
  const idiomaFormatado = idioma.replace("_", "-");
  const filePath = path.join(__dirname, "frontend", "locales", `termo_${idiomaFormatado}.md`);
  console.log("📄 Buscando termo em:", filePath);

  try {
    const conteudo = await fsPromises.readFile(filePath, "utf8");
    return conteudo;
  } catch (erro) {
    console.error("❌ Erro ao ler termo markdown:", erro.message);
    throw new Error("Termo não encontrado para o idioma: " + idiomaFormatado);
  }
});


// ⛔ Encerramento do app
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    console.log("🛑 Todas as janelas fechadas. Encerrando app...");
    app.quit();
  }
});



