// backend/lib/sessionStore.js
let sessaoAtiva = false;

function setLoginAtivo(estado) {
  console.log("🧩 Sessão ativa definida para:", estado);
  sessaoAtiva = estado;
}

function isLoginAtivo() {
  return sessaoAtiva;
}

module.exports = { setLoginAtivo, isLoginAtivo };

