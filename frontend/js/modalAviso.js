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

    // 🔁 Tenta encontrar os elementos por até 1 segundo (10 tentativas)
    const tentarExibir = (tentativas = 10) => {
      const modal = document.getElementById("modalAviso");
      const tituloEl = document.getElementById("modalAvisoTitulo");
      const textoEl = document.getElementById("modalAvisoTexto");
      const btnFechar = document.getElementById("modalAvisoFechar");

      if (!modal || !tituloEl || !textoEl || !btnFechar) {
        if (tentativas > 0) {
          setTimeout(() => tentarExibir(tentativas - 1), 100);
        } else {
          console.warn("⚠️ Elementos do modal não encontrados após múltiplas tentativas.");
          resolve();
        }
        return;
      }

      tituloEl.textContent = tipo;
      textoEl.innerHTML = mensagem;
      modal.style.display = "flex";

      const novoBtnFechar = btnFechar.cloneNode(true);
      btnFechar.parentNode.replaceChild(novoBtnFechar, btnFechar);

      novoBtnFechar.onclick = () => {
        modal.style.display = "none";
        if (typeof aoFechar === "function") aoFechar();
        resolve();
      };
    };

    tentarExibir();
  });
}
