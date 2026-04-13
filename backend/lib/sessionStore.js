let sessaoAtiva = {
  emailHash: null,
  activeRole: null,
};

function definirSessaoAtiva(emailHash) {
  sessaoAtiva.emailHash = emailHash;
}

function definirPerfilAtivo(role) {
  const r = String(role || "").trim().toLowerCase();
  sessaoAtiva.activeRole = r || null;
}

function obterEmailHashAtivo() {
  return sessaoAtiva.emailHash;
}

function obterPerfilAtivo() {
  return sessaoAtiva.activeRole;
}

function isLoginAtivo() {
  return !!sessaoAtiva.emailHash;
}

function limparSessao() {
  sessaoAtiva.emailHash = null;
  sessaoAtiva.activeRole = null;
}

module.exports = {
  definirSessaoAtiva,
  definirPerfilAtivo,
  obterEmailHashAtivo,
  obterPerfilAtivo,
  isLoginAtivo,
  limparSessao,
};
