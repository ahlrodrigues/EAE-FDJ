// === js/modalAviso.js ===
export function exibirAviso(tituloOuConfig, mensagemHtmlOpcional) {
  const modal = document.getElementById("modalAviso");
  const tituloEl = document.getElementById("modalAvisoTitulo");
  const textoEl = document.getElementById("modalAvisoTexto");
  const btnFechar = document.getElementById("modalAvisoFechar");

  if (!modal || !tituloEl || !textoEl || !btnFechar) return;

  let titulo = "";
  let mensagem = "";
  let aoFechar = null;

  if (typeof tituloOuConfig === "object") {
    titulo = tituloOuConfig.tipo === "erro" ? "❌ Erro" :
             tituloOuConfig.tipo === "sucesso" ? "✅ Sucesso" :
             "ℹ️ Aviso";
    mensagem = tituloOuConfig.mensagem || "";
    aoFechar = tituloOuConfig.aoFechar;
  } else {
    titulo = tituloOuConfig;
    mensagem = mensagemHtmlOpcional;
  }

  tituloEl.textContent = titulo;
  textoEl.innerHTML = mensagem;
  modal.style.display = "flex";

  btnFechar.onclick = () => {
    console.log("👋 Botão fechar clicado.");
    modal.style.display = "none";
    if (typeof aoFechar === "function") {
      aoFechar();
    }
  };
}

if (document.readyState !== "loading") {
  carregarModalAviso();
} else {
  document.addEventListener("DOMContentLoaded", carregarModalAviso);
}

function carregarModalAviso() {
  const container = document.getElementById("modalAvisoContainer");
  if (!container) return;
  fetch("componentes/modalAviso.html")
    .then(res => res.text())
    .then(html => container.innerHTML = html)
    .catch(err => console.error("❌ Erro ao carregar modalAviso.html:", err));
}