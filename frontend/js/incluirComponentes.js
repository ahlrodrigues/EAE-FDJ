export const componentesCarregados = (async function incluirComponentes() {
  const incluirHTML = async (id, arquivo) => {
    const el = document.getElementById(id);
    if (el) {
      try {
        const resposta = await fetch(arquivo);
        if (resposta.ok) {
          const html = await resposta.text();
          el.innerHTML = html;
          console.log(`✅ Componente incluído em #${id}: ${arquivo}`);

          // ⏱️ Dispara evento customizado para sinalizar que o componente foi carregado
          const evento = new CustomEvent("componenteCarregado", { detail: { id } });
          el.dispatchEvent(evento);
        }
      } catch (erro) {
        console.error(`❌ Erro ao carregar ${arquivo}:`, erro);
      }
    }
  };

  await incluirHTML("cabecalho", "componentes/cabecalho.html");
  await incluirHTML("menuSuperior", "componentes/menu-Superior.html");
  await incluirHTML("rodape", "componentes/rodape.html");
})();
