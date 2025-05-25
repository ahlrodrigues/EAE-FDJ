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

// ✅ Expor API para o renderer
contextBridge.exposeInMainWorld("electronAPI", {
  validarLogin: (email, senha) => {
    console.log("📡 [PRELOAD] validar-login", email, senha);
    return ipcRenderer.invoke("validar-login", email, senha);
  },
  salvarCadastro: async (dados) => {
    console.log("📡 [PRELOAD] salvar-cadastro", dados);
    return ipcRenderer.invoke("salvar-cadastro", dados);
  },
  buscarUltimaPublicacao: () => {
    console.log("📡 [PRELOAD] blog:buscarUltimaPublicacao");
    return ipcRenderer.invoke("blog:buscarUltimaPublicacao");
  },
  verificarEmailExistente: (email) => {
    console.log("📡 [PRELOAD] verificar-email-existente", email);
    return ipcRenderer.invoke("verificar-email-existente", email);
  },
  solicitarToken: (email) => {
    console.log("📡 [PRELOAD] solicitarToken chamado com:", email);
    return ipcRenderer.invoke("senha:solicitar-token", email);
  },
  redefinirSenha: (dados) => {
    console.log("📡 [PRELOAD] redefinirSenha chamado com:", dados);
    return ipcRenderer.invoke("senha:redefinir", dados);
  },
});

// ✅ Log fora da definição do objeto
console.log("🧪 blogAPI disponível no preload:", typeof window.api?.buscarUltimaPublicacao);

console.log("🚀 [PRELOAD] Estou no preload e ativo!");
window.addEventListener("DOMContentLoaded", () => {
  console.log("📦 [PRELOAD] DOM totalmente carregado");
});
