// === preload.js ===
const { contextBridge, ipcRenderer } = require('electron');
console.log("🧠 preload.js carregado");

const fs = require("fs");
const path = require("path");
const os = require("os");
const { descriptografarComMestra } = require("./backend/lib/criptografia");

contextBridge.exposeInMainWorld("nativo", {
  fs,
  path,
  os,
  descriptografarComMestra,
});

// Teste direto:
contextBridge.exposeInMainWorld("api", {
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  salvarCadastro: async (dados) => ipcRenderer.invoke('salvar-cadastro', dados),
  teste: () => console.log("✅ teste chamado do preload"),
});

console.log("🧠 preload.js executado");
window.api = { testar: () => console.log("✅ API disponível!") };