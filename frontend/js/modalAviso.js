export function exibirAviso(input) {
  return new Promise((resolve) => {
    let tipo = "Aviso";
    let mensagem = "";
    let aoFechar = null;

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
      resolve(); // Libera mesmo se não encontrar os elementos
      return;
    }

    tituloEl.textContent = tipo;
    textoEl.innerHTML = mensagem;
    modal.style.display = "flex";

    // Substitui botão para remover antigos listeners
    const novoBtnFechar = btnFechar.cloneNode(true);
    btnFechar.parentNode.replaceChild(novoBtnFechar, btnFechar);

    novoBtnFechar.onclick = () => {
      modal.style.display = "none";
      if (typeof aoFechar === "function") aoFechar();
      resolve(); // ✅ Libera o await
    };
  });
}
