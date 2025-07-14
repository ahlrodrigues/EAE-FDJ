document.addEventListener("DOMContentLoaded", async () => {
  console.log("📘 Carregando capa da revista...");

  const container = document.getElementById("revistaTrevoContainer");
  if (!container) {
    console.warn("⚠️ Elemento #revistaTrevoContainer não encontrado.");
    return;
  }

  try {
    const caminhoCapa = await window.api.obterCaminhoCapaRevista();

    if (caminhoCapa) {
      console.log("✅ Capa encontrada:", caminhoCapa);
      container.innerHTML = `
        <img src="${caminhoCapa}" alt="Capa da Revista O Trevo"
          style="width: 60%; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);" />
      `;
    } else {
      console.warn("❌ Nenhuma capa disponível.");
      container.innerHTML = `<p style="text-align:center;">⚠️ Nenhuma capa disponível no momento.</p>`;
    }

  } catch (error) {
    console.error("❌ Erro ao carregar capa da revista:", error.message);
    container.innerHTML = `<p style="text-align:center;">⚠️ Erro ao carregar a capa.</p>`;
  }
});
