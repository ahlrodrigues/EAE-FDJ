export const componentesCarregados = (async function incluirComponentes() {
  const incluirHTML = async (id, arquivo) => {
    console.log(`🔍 Procurando #${id}...`);
    const el = document.getElementById(id);
  
    if (!el) {
      console.warn(`⚠️ Elemento #${id} não encontrado no DOM para injetar ${arquivo}`);
      return;
    }
  
    try {
      const resposta = await fetch(arquivo);
      if (resposta.ok) {
        const html = await resposta.text();
        el.innerHTML = html;
        console.log(`✅ Componente incluído em #${id}: ${arquivo}`);
      } else {
        console.error(`❌ Falha ao carregar ${arquivo}: ${resposta.status}`);
      }
    } catch (erro) {
      console.error(`❌ Erro ao carregar ${arquivo}:`, erro);
    }
  };

  await incluirHTML("cabecalho", "componentes/cabecalho.html");
  await incluirHTML("menuSuperior", "componentes/menu-Superior.html");
  await incluirHTML("rodape", "componentes/rodape.html");
  await incluirHTML("modalAvisoContainer", "componentes/modalAviso.html");
})();
