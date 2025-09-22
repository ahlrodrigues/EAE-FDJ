// ============================================================================
// Caminho: frontend/js/revista.js
// Objetivo: carregar a capa mais recente da revista e exibir no contêiner
// Contêiner suportado: #revistaTrevoContainer (preferencial) ou #revistaContainer (fallback)
// Logs: 📖[RENDER][REVISTA]
// Dependências expostas no preload: window.api.obterCaminhoCapaRevista(), window.api.toFileURL()
// ============================================================================
const LOG = "📖[RENDER][REVISTA]";
const PRIMARY_CONTAINER_ID = "revistaTrevoContainer";
const FALLBACK_CONTAINER_ID = "revistaContainer";

/** Procura o contêiner principal e, se não existir, tenta o fallback. */
function getRevistaContainer() {
  const primary = document.getElementById(PRIMARY_CONTAINER_ID);
  if (primary) return { el: primary, id: PRIMARY_CONTAINER_ID };
  const fallback = document.getElementById(FALLBACK_CONTAINER_ID);
  if (fallback) return { el: fallback, id: FALLBACK_CONTAINER_ID };
  return { el: null, id: null };
}

/** Renderiza um skeleton simples enquanto carrega. */
function renderSkeleton(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;">
      <div style="width:60%;height:260px;border-radius:8px;background:#f2f2f2;"></div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log(`${LOG} DOMContentLoaded → iniciando fluxo de capa`);
  const { el: container, id: containerId } = getRevistaContainer();

  if (!container) {
    console.warn(`${LOG} ⚠️ Contêiner não encontrado (IDs testados: #${PRIMARY_CONTAINER_ID}, #${FALLBACK_CONTAINER_ID}).`);
    return;
  }
  console.log(`${LOG} Contêiner encontrado: #${containerId}`);
  renderSkeleton(container);

  try {
    // 1) Solicita o caminho/URL da capa (o handler já deve retornar "file://..." quando local)
    const capaPathOrUrl = await window.api.obterCaminhoCapaRevista();
    console.log(`${LOG} Resposta do handler (capaPathOrUrl):`, capaPathOrUrl);

    if (!capaPathOrUrl) {
      console.warn(`${LOG} ❌ Nenhuma capa disponível na pasta configurada.`);
      container.innerHTML = `<p style="text-align:center;">⚠️ Nenhuma capa disponível no momento.</p>`;
      return;
    }

    // 2) Normaliza em URL exibível no <img src>. Se vier caminho local sem "file://", converte.
    let imgSrc = capaPathOrUrl;
    if (typeof imgSrc === "string" && !/^https?:\/\//i.test(imgSrc) && !/^file:\/\//i.test(imgSrc)) {
      try {
        imgSrc = await window.api.toFileURL(imgSrc);
        console.log(`${LOG} Caminho convertido para file URL: ${imgSrc}`);
      } catch (convErr) {
        console.warn(`${LOG} Não foi possível converter com toFileURL. Tentando prefixo file:// padrão.`);
        imgSrc = `file://${capaPathOrUrl}`;
      }
    }

    // 3) Renderiza imagem
    container.innerHTML = `
      <div style="display:flex;justify-content:center;">
        <img
          src="${imgSrc}"
          alt="Capa da Revista O Trevo"
          class="revista-capa"
          style="max-width: 100%; width: 60%; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);" />
      </div>
    `;
    console.log(`${LOG} ✅ Capa renderizada com sucesso: ${imgSrc}`);
  } catch (error) {
    console.error(`${LOG} ❌ Erro ao carregar capa da revista:`, error);
    container.innerHTML = `<p style="text-align:center;">⚠️ Erro ao carregar a capa.</p>`;
  }
});
