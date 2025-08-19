// === js/incluirComponentes.js ===
// Carrega cabeçalho, menuSuperior, rodapé e modalAviso se os elementos existirem

export const componentesCarregados = (async function incluirComponentes() {
  const incluirHTML = async (id, arquivo) => {
    console.log(`🔍 Procurando #${id} para injetar ${arquivo}`);
    const el = document.getElementById(id);

    if (!el) {
      console.warn(`⚠️ Elemento #${id} não encontrado no DOM. Ignorando ${arquivo}`);
      return;
    }

    try {
      const resposta = await fetch(arquivo);
      if (resposta.ok) {
        const html = await resposta.text();
        el.innerHTML = html;
        console.log(`✅ Componente incluído em #${id}: ${arquivo}`);
      } else {
        console.error(`❌ Falha ao carregar ${arquivo}: status ${resposta.status}`);
      }
    } catch (erro) {
      console.error(`❌ Erro ao carregar ${arquivo}:`, erro);
    }
  };

  // Cabeçalho sempre incluso se existir
  await incluirHTML("cabecalho", "componentes/cabecalho.html");

  // 🔐 Menu superior só é incluído se houver sessão ativa
  const emailHash = sessionStorage.getItem("emailHash");
  if (emailHash) {
    await incluirHTML("menuSuperior", "componentes/menuSuperior.html");
  } else {
    console.log("⛔ Nenhuma sessão ativa (emailHash). Menu superior não será carregado.");
  }

  // Rodapé sempre incluso se existir
  await incluirHTML("rodape", "componentes/rodape.html");

  // Modal de aviso (usado em todas as telas)
  await incluirHTML("modalAvisoContainer", "componentes/modalAviso.html");
  
  // Regras de senha
  await incluirHTML("senhaRegrasContainer", "componentes/senhaRegras.html");


})();

const menuEl = document.getElementById("menuSuperior");
if (menuEl && menuEl.querySelector("#webRadioImg") && menuEl.querySelector("#webRadioPlayer")) {
  console.log("[Componentes] menuSuperior injetado com sucesso (contém rádio).");
  window.dispatchEvent(new CustomEvent("menu:ready", { detail: { source: "menuSuperior" } }));
} else {
  console.warn("[Componentes] menuSuperior injetado, mas rádio não encontrado (verifique IDs).");
}
