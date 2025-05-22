export function exibirAviso({ tipo = "Aviso", mensagem = "", aoFechar = null }) {
  const modal = document.getElementById("modalAviso");
  const tituloEl = document.getElementById("modalAvisoTitulo");
  const textoEl = document.getElementById("modalAvisoTexto");
  const btnFechar = document.getElementById("modalAvisoFechar");

  if (!modal || !tituloEl || !textoEl || !btnFechar) {
    console.warn("⚠️ Elementos do modal não encontrados.");
    return;
  }

  tituloEl.textContent = tipo;
  textoEl.innerHTML = mensagem;
  modal.style.display = "flex";

  // Garante que o botão fechar está limpo antes de adicionar
  const novoBtnFechar = btnFechar.cloneNode(true);
  btnFechar.parentNode.replaceChild(novoBtnFechar, btnFechar);

  novoBtnFechar.onclick = () => {
    modal.style.display = "none";
    if (typeof aoFechar === "function") aoFechar();
  };
}
