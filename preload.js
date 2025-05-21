// === preload.js ===
const { contextBridge, ipcRenderer } = require('electron');
console.log("🧠 preload.js carregado");

// Teste direto:
contextBridge.exposeInMainWorld("api", {
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  salvarCadastro: async (dados) => ipcRenderer.invoke('salvar-cadastro', dados),
  teste: () => console.log("✅ teste chamado do preload"),
});

console.log("🧠 preload.js executado");
window.api = { testar: () => console.log("✅ API disponível!") };