let sessaoAtiva = {
  emailHash: null,
};

function definirSessaoAtiva(emailHash) {
  sessaoAtiva.emailHash = emailHash;
}

function obterEmailHashAtivo() {
  return sessaoAtiva.emailHash;
}

function isLoginAtivo() {
  return !!sessaoAtiva.emailHash;
}

function limparSessao() {
  sessaoAtiva.emailHash = null;
}

module.exports = {
  definirSessaoAtiva,
  obterEmailHashAtivo,
  isLoginAtivo,
  limparSessao,
};
