
function gerarToken(tamanho = 6) {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < tamanho; i++) {
    token += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return token;
}

module.exports = { gerarToken };
