// ============================================================================
// Caminho: frontend/js/modalAviso.js
// Modal de aviso reutilizável (compat + robusto)
// - Mantém compatibilidade com IDs existentes (#modalAviso, #modalAvisoTitulo,
//   #modalAvisoTexto, #modalAvisoFechar)
// - Se a estrutura não existir, cria dinamicamente no <body>
// - Abre via classe .ativo; fecha por botão, ESC e clique no overlay
// - Suporta autoFecharMs e restaura foco ao fechar
// - Evita múltiplos listeners acumulados
// Logs: [MODAL-AVISO]
// ============================================================================
const LOG = "[MODAL-AVISO]";

let _escListener = null;
let _clickListener = null;
let _autoTimer = null;
let _lastFocusEl = null;

// Cria estrutura mínima se não existir
function ensureStructure() {
  let modal = document.getElementById("modalAviso");
  if (modal) return modal;

  console.warn(`${LOG} Estrutura do modal não encontrada. Criando dinamicamente...`);

  modal = document.createElement("div");
  modal.id = "modalAviso";
  modal.className = "modal-aviso"; // CSS deve controlar display por .ativo
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "modalAvisoTitulo");
  modal.setAttribute("aria-describedby", "modalAvisoTexto");

  modal.innerHTML = `
    <div class="modal-aviso__overlay" data-modal-close="1"></div>
    <div class="modal-aviso__caixa" role="document" tabindex="-1">
      <div class="modal-aviso__header">
        <h3 id="modalAvisoTitulo" class="modal-aviso__titulo">Aviso</h3>
        <button id="modalAvisoFechar" class="modal-aviso__btn-fechar" aria-label="Fechar" data-modal-close="1">×</button>
      </div>
      <div id="modalAvisoTexto" class="modal-aviso__mensagem"></div>
      <div class="modal-aviso__footer">
        <button class="modal-aviso__btn-ok" data-modal-close="1">OK</button>
      </div>
    </div>
  `;

  // Se houver um container dedicado, usa-o; senão, vai no body
  const cont = document.getElementById("modalAvisoContainer");
  (cont ?? document.body).appendChild(modal);
  return modal;
}

// Fecha com limpeza completa
function fecharModal(motivo, resolver) {
  try {
    const modal = document.getElementById("modalAviso");
    if (modal) {
      modal.classList.remove("ativo");
      modal.style.removeProperty("display");
    }
    // limpa listeners
    if (_escListener) window.removeEventListener("keydown", _escListener);
    if (_clickListener && modal) modal.removeEventListener("click", _clickListener);
    if (_autoTimer) clearTimeout(_autoTimer);
    _escListener = _clickListener = _autoTimer = null;

    // restaura foco
    try { _lastFocusEl?.focus?.(); } catch {}
    _lastFocusEl = null;

    console.log(`${LOG} Fechado (motivo=${motivo})`);
  } finally {
    resolver?.();
  }
}

// Exibe o modal
export function exibirAviso(input) {
  return new Promise((resolve) => {
    // Normaliza opções
    let tipo = "Aviso";
    let mensagem = "";
    let aoFechar = null;
    let autoFecharMs = 0;
    let focoSelector = null; // opcional

    if (typeof input === "object" && input !== null) {
      tipo = input.tipo || "Aviso";
      mensagem = input.mensagem || "";
      aoFechar = input.aoFechar || null;
      autoFecharMs = Number(input.autoFecharMs || 0) || 0;
      focoSelector = input.focoSelector || null;
    } else {
      mensagem = String(input);
    }

    // Garante estrutura
    const modal = ensureStructure();
    const tituloEl = document.getElementById("modalAvisoTitulo");
    const textoEl = document.getElementById("modalAvisoTexto");
    const btnFechar = document.getElementById("modalAvisoFechar");

    if (!modal || !tituloEl || !textoEl || !btnFechar) {
      console.warn(`${LOG} ❌ Estrutura do modal indisponível.`);
      return resolve();
    }

    // Preenche conteúdo
    tituloEl.textContent = tipo;
    // Mantém compatibilidade: aceita HTML na mensagem
    textoEl.innerHTML = String(mensagem).replace(/\n/g, "<br/>");

    // Armazena foco para restaurar depois
    _lastFocusEl = focoSelector ? document.querySelector(focoSelector) : document.activeElement;

    // Remove possíveis timers/listeners anteriores
    if (_escListener) window.removeEventListener("keydown", _escListener);
    if (_clickListener) modal.removeEventListener("click", _clickListener);
    if (_autoTimer) clearTimeout(_autoTimer);
    _escListener = _clickListener = _autoTimer = null;

    // Abre (classe .ativo controla display)
    modal.style.removeProperty("display");
    modal.classList.add("ativo");

    // Foca a caixa do modal (acessibilidade)
    const caixa = modal.querySelector(".modal-aviso__caixa");
    setTimeout(() => { try { caixa?.focus?.(); } catch {} }, 10);

    const resolverFechar = () => {
      try { typeof aoFechar === "function" && aoFechar(); } catch (err) { console.error(`${LOG} aoFechar erro:`, err); }
      resolve();
    };

    // Delegação de clique (overlay, botão fechar, OK)
    _clickListener = (ev) => {
      const target = ev.target;
      // fecha por overlay/botão com data-modal-close="1" OU clique fora da caixa
      const isDataClose = target?.closest?.("[data-modal-close='1']");
      const clicouForaCaixa = !target?.closest?.(".modal-aviso__caixa");
      if (isDataClose || (target === modal) || clicouForaCaixa) {
        fecharModal(isDataClose ? "btn/overlay" : "fora-caixa", resolverFechar);
      }
    };
    modal.addEventListener("click", _clickListener);

    // ESC
    _escListener = (ev) => {
      if (ev.key === "Escape") fecharModal("esc", resolverFechar);
    };
    window.addEventListener("keydown", _escListener);

    // autoFechar opcional
    if (autoFecharMs > 0) {
      _autoTimer = setTimeout(() => fecharModal("auto", resolverFechar), autoFecharMs);
    }

    console.log(`${LOG} ✅ Exibido (tipo="${tipo}", bytes=${mensagem.length}, autoFecharMs=${autoFecharMs})`);
  });
}
