document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('ultima-publicacao');

  console.log("🚀 [RENDERER] window.api:", window.api);

  if (!window.api || typeof window.api.buscarUltimaPublicacao !== 'function') {
    console.error("❌ [RENDERER] api.buscarUltimaPublicacao não disponível");
    container.textContent = "Erro ao carregar publicação.";
    return;
  }

  try {
    console.log("📡 [RENDERER] Chamando buscarUltimaPublicacao()");
    const dados = await window.api.buscarUltimaPublicacao();
    console.log("✅ [RENDERER] Dados recebidos:", dados);

    if (dados && dados.titulo && dados.link) {
      container.innerHTML = `
  <div class="card">
    <h4 class="blog-titulo">${dados.titulo}</h4>
    <p class="blog-descricao">${dados.descricao}</p>
    <div class="blog-link-container">
      <a href="${dados.link}" target="_blank" class="blog-link">Ler o artigo</a>
    </div>
  </div>
`;

    } else {
      container.textContent = "Nenhuma publicação encontrada.";
    }
  } catch (e) {
    console.error("❌ [RENDERER] Erro ao carregar blog:", e);
    container.textContent = "Erro ao carregar a publicação mais recente.";
  }
});
