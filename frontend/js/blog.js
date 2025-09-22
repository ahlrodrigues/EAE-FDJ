// ============================================================================
// Caminho: frontend/js/blog.js
// Objetivo: carregar e exibir a última publicação do blog no contêiner #ultima-publicacao
// Depende do preload: window.api.blogDebugPing() e window.api.buscarUltimaPublicacao()
// Logs: 🧩[RENDER][BLOG]
// ============================================================================
const LOG = "🧩[RENDER][BLOG]";
const CONTAINER_ID = "ultima-publicacao";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatarData(iso) {
  try {
    return iso ? new Date(iso).toLocaleString("pt-BR") : "";
  } catch {
    return "";
  }
}

function renderSkeleton($el) {
  $el.innerHTML = `
    <section class="card" id="cartao-blog">
      <div class="skeleton">Carregando novidades do blog…</div>
    </section>
  `;
}

function renderErro($el, msg = "Não foi possível carregar as novidades do blog no momento.") {
  $el.innerHTML = `
    <section class="card" id="cartao-blog">
      <div class="alert warn">${escapeHtml(msg)}</div>
    </section>
  `;
}

function renderPost($el, { titulo, resumo, url, dataISO }, fonte) {
  const dataFmt = formatarData(dataISO);
  const safeTitulo = escapeHtml(titulo || "Sem título");
  const safeResumo = escapeHtml(resumo || "");

  // Texto único do link: "Ler mais... Fonte • Data"
  const linkTexto = `Ler mais... `;

  $el.innerHTML = `
    <section class="card" id="cartao-blog">
      <h3>Novidades do Blog</h3>

      <div class="blog-card">
        <h4 class="blog-titulo">${safeTitulo}</h4>
        <p class="blog-resumo">${safeResumo}</p>

        <div class="blog-rodape">
          <a
            href="#"
            id="blogLinkMais"
            class="blog-rodape-link"
            aria-label="Ler a publicação no site (abre no navegador padrão)"
            rel="noopener"
          >
            ${linkTexto}
          </a>
        </div>
      </div>
    </section>
  `;

  const $link = $el.querySelector("#blogLinkMais");
  if ($link && url) {
    $link.addEventListener("click", (ev) => {
      ev.preventDefault();
      console.log(`${LOG} Abrir link externo via preload:`, url);
      // Usa a API do preload para abrir no navegador padrão (segurança)
      try {
        window.api?.abrirLink?.(url);
      } catch (e) {
        console.warn(`${LOG} Falha ao chamar abrirLink, fallback window.open`, e);
        // fallback (menos recomendado no Electron, mas útil se preload não estiver disponível)
        window.open(url, "_blank", "noopener");
      }
    });
  } else {
    console.warn(`${LOG} Link do blog indisponível:`, { temElemento: Boolean($link), url });
  }
}


async function carregarBlog() {
  const $container = document.getElementById(CONTAINER_ID);
  if (!$container) {
    console.warn(`${LOG} Contêiner #${CONTAINER_ID} não encontrado no DOM.`);
    return;
  }

  renderSkeleton($container);

  // Ping opcional (diagnóstico)
  try {
    const ping = await window.api?.blogDebugPing?.();
    console.log(`${LOG} ping:`, ping);
  } catch (e) {
    console.warn(`${LOG} ping falhou:`, e?.message || e);
  }

  // Buscar última publicação
  try {
    const resp = await window.api?.buscarUltimaPublicacao?.();
    console.log(`${LOG} resposta buscarUltimaPublicacao:`, resp);

    if (!resp?.ok || !resp?.publicacao) {
      renderErro($container, resp?.erro || "Falha ao obter o feed.");
      return;
    }

    renderPost($container, resp.publicacao, resp.fonte);
  } catch (e) {
    console.error(`${LOG} erro geral:`, e?.message || e);
    renderErro($container);
  }
}

// Inicializa no carregamento do DOM
document.addEventListener("DOMContentLoaded", () => {
  console.log(`${LOG} DOM carregado → iniciar carregarBlog()`);
  carregarBlog();
});
