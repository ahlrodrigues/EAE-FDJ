
export function exibirAviso(input) {
  let tipo = "Aviso";
  let mensagem = "";
  let aoFechar = null;

  // Permite chamar com string simples: exibirAviso("Mensagem direta")
  if (typeof input === "object" && input !== null) {
    tipo = input.tipo || "Aviso";
    mensagem = input.mensagem || "";
    aoFechar = input.aoFechar || null;
  } else {
    mensagem = String(input);
  }

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
