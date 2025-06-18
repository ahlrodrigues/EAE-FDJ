// === preload.js ===
const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { criptografarComMestra, descriptografarComMestra } = require("./backend/lib/criptografia");
const dotenv = require("dotenv");
dotenv.config();

console.log("🧠 preload.js carregado");

// ✅ Expor acesso nativo ao sistema
contextBridge.exposeInMainWorld("nativo", {
  fs,
  path,
  os,
  criptografarComMestra,
  descriptografarComMestra,
  getEnv: (chave) => process.env[chave] || null,
});

// ✅ Expor API de comunicação com o main.js
contextBridge.exposeInMainWorld("api", {
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  salvarCadastro: (dados) => ipcRenderer.invoke("salvar-cadastro", dados),
  verificarEmailExistente: (email) => ipcRenderer.invoke("verificar-email-existente", email),
  solicitarToken: (email) => ipcRenderer.invoke("solicitar-token", email),
  buscarUltimaPublicacao: () => ipcRenderer.invoke("blog:buscarUltimaPublicacao"),
  redefinirSenha: (email, token, novaSenha) => ipcRenderer.invoke("redefinir-senha", email, token, novaSenha),
  lerUsuario: async () => ipcRenderer.invoke("ler-usuario"),
  descriptografarComMestra: (texto) => {return ipcRenderer.invoke("descriptografar-com-mestra", texto);},
  
});

// ✅ Log de teste
console.log("🧪 preload pronto. APIs carregadas.");
