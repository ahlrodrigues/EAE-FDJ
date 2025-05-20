// === main.js ===
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const registrarCadastroHandler = require('./backend/handlers/cadastroHandler');

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, 'frontend', 'assets', 'trevo.png'), // Caminho do ícone
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('frontend/cadastro.html');
};

app.whenReady().then(() => {
  registrarCadastroHandler(ipcMain);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
