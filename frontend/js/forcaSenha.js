
export function inicializarForcaSenha() {
  const senhaInput = document.getElementById("senha");
  const forcaSenhaEl = document.getElementById("forcaSenha");

  if (!senhaInput || !forcaSenhaEl || typeof zxcvbn !== "function") {
    console.warn("⚠️ Elementos de senha ou zxcvbn não disponíveis.");
    return;
  }

  senhaInput.addEventListener("input", () => {
    const senha = senhaInput.value;
    const resultado = zxcvbn(senha);
    const forca = resultado.score;

    let mensagem = "";
    switch (forca) {
      case 0:
      case 1:
        mensagem = "🔴 Senha fraca";
        break;
      case 2:
        mensagem = "🟡 Senha razoável";
        break;
      case 3:
        mensagem = "🟢 Boa senha";
        break;
      case 4:
        mensagem = "🟢🔵 Senha forte!";
        break;
    }
    forcaSenhaEl.textContent = mensagem;
  });
}
