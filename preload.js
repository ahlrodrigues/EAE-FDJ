// === preload.js ===
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  salvarCadastro: async (dados) => ipcRenderer.invoke('salvar-cadastro', dados)
});