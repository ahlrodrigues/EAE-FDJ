// frontend/js/modalAviso.js
// Modal de aviso reutilizável
// - Abre e fecha via classe .ativo (CSS controla display)
// - Fecha por botão, tecla ESC e clique fora (overlay)
// - Inclui logs e limpeza de listeners

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

    const tentarExibir = (tentativas = 10) => {
      const modal = document.getElementById("modalAviso");
      const tituloEl = document.getElementById("modalAvisoTitulo");
      const textoEl = document.getElementById("modalAvisoTexto");
      const btnFechar = document.getElementById("modalAvisoFechar");

      if (!modal || !tituloEl || !textoEl || !btnFechar) {
        if (tentativas > 0) {
          console.log(`[MODAL-AVISO] Aguardando injeção do componente... tentativas restantes: ${tentativas}`);
          setTimeout(() => tentarExibir(tentativas - 1), 100);
        } else {
          console.warn("[MODAL-AVISO] ❌ Modal não encontrado após 10 tentativas.");
          resolve();
        }
        return;
      }

      console.log("[MODAL-AVISO] ✅ Modal encontrado. Exibindo...");

      // Preenche conteúdo
      tituloEl.textContent = tipo;
      textoEl.innerHTML = mensagem;

      // 🔄 Limpeza de display inline e abertura por classe
      modal.style.removeProperty("display");
      modal.classList.add("ativo");

      // 🔁 Substitui o botão para limpar listeners antigos
      const novoBtnFechar = btnFechar.cloneNode(true);
      btnFechar.replaceWith(novoBtnFechar);

      const fecharModal = (origem = "desconhecida") => {
        console.log(`[MODAL-AVISO] 🧹 Fechando modal (origem: ${origem})`);
        modal.classList.remove("ativo");
        modal.style.removeProperty("display");
        if (typeof aoFechar === "function") {
          try {
            aoFechar();
          } catch (err) {
            console.error("[MODAL-AVISO] Erro ao executar aoFechar:", err);
          }
        }
        // Remove handlers globais adicionados
        window.removeEventListener("keydown", onKeyEsc);
        modal.removeEventListener("click", onOverlayClick);
        resolve();
      };

      // Clique no botão fechar
      novoBtnFechar.addEventListener("click", () => fecharModal("btnFechar"));

      // Clique no overlay (fora da caixa) — opcional
      const onOverlayClick = (ev) => {
        if (ev.target === modal) fecharModal("overlay");
      };
      modal.addEventListener("click", onOverlayClick);

      // Tecla ESC
      const onKeyEsc = (ev) => {
        if (ev.key === "Escape") fecharModal("esc");
      };
      window.addEventListener("keydown", onKeyEsc);
    };

    tentarExibir();
  });
}
