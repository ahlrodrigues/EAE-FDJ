window.exibirAviso = function (titulo, mensagemHtml) {
  const modal = document.getElementById("modalAviso");
  const tituloEl = document.getElementById("modalAvisoTitulo");
  const textoEl = document.getElementById("modalAvisoTexto");

  if (!modal || !tituloEl || !textoEl) {
    console.warn("⚠️ Elementos do modal não encontrados.");
    return;
  }

  tituloEl.textContent = titulo;
  textoEl.innerHTML = mensagemHtml;
  modal.style.display = "flex";

  const btnFechar = document.getElementById("modalAvisoFechar");
  if (btnFechar) {
    btnFechar.onclick = () => {
      modal.style.display = "none";
    };
  }
};
