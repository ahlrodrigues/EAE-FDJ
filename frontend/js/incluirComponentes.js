// js/incluirComponentes.js
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
        } else {
          console.warn(`⚠️ Não foi possível carregar ${arquivo}: ${resposta.status}`);
        }
      } catch (erro) {
        console.error(`❌ Erro ao carregar ${arquivo}:`, erro);
      }
    }
  };

  await incluirHTML("cabecalho", "componentes/cabecalho.html");
  await incluirHTML("senhaRegrasContainer", "componentes/senhaRegras.html");
  await incluirHTML("modalAvisoContainer", "componentes/modalAviso.html");
  await incluirHTML("rodape", "componentes/rodape.html");
  await incluirHTML("menuSuperior", "componentes/menuSuperior.html");
})();

// ✅ Espera os componentes serem carregados para ativar o item do menu
componentesCarregados.then(() => {
  const atual = window.location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll(".menu-superior a");

  links.forEach(link => {
    const href = link.getAttribute("href");
    if (href === atual) {
      link.classList.add("ativo");
      link.addEventListener("click", (e) => {
        e.preventDefault(); // ✅ Evita reload
        console.log("🔄 Clique ignorado: já está na página atual.");
      });
    }
  });
});
