// === preload.js ===
const { contextBridge, ipcRenderer } = require('electron');
console.log("🧠 preload.js carregado");

const fs = require("fs");
const path = require("path");
const os = require("os");
const { criptografarComMestra, descriptografarComMestra } = require("./backend/lib/criptografia");

contextBridge.exposeInMainWorld("nativo", {
  fs,
  path,
  os,
  descriptografarComMestra,
  criptografarComMestra,
});

// ✅ Expor API para o renderer
contextBridge.exposeInMainWorld("api", {
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  salvarCadastro: async (dados) => ipcRenderer.invoke('salvar-cadastro', dados),
  teste: () => console.log("✅ teste chamado do preload"),
  buscarUltimaPublicacao: () => ipcRenderer.invoke('blog:buscarUltimaPublicacao'),
  verificarEmailExistente: (email) => ipcRenderer.invoke("verificar-email-existente", email),
  redefinirSenha: (token, novaSenha) => ipcRenderer.invoke("redefinir-senha", token, novaSenha),
});

// ✅ Log fora da definição do objeto
console.log("🧪 blogAPI disponível no preload:", typeof window.api?.buscarUltimaPublicacao);

// ✅ Atribuição direta no contexto da janela (útil para debug)
window.api = {
  ...window.api,
  testar: () => console.log("✅ API disponível!")
};