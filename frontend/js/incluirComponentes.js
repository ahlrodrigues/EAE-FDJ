document.addEventListener("DOMContentLoaded", () => {
  const incluir = async (id, caminho, callback) => {
    try {
      const destino = document.getElementById(id);
      if (!destino) {
        console.warn(`⚠️ Elemento com ID "${id}" não encontrado. Componente "${caminho}" não será carregado.`);
        return;
      }

      const resp = await fetch(caminho);
      const html = await resp.text();
      destino.innerHTML = html;
      console.log(`✅ Componente "${id}" incluído de "${caminho}"`);

      if (callback) callback();
    } catch (erro) {
      console.error(`❌ Erro ao incluir ${caminho}:`, erro);
    }
  };

  // 🔽 Chamadas de inclusão dos componentes
  incluir("cabecalho", "componentes/cabecalho.html");

  incluir("senhaRegrasContainer", "componentes/senhaRegras.html", () => {
    requestAnimationFrame(() => {
      import("./validacaoSenha.js")
        .then(() => console.log("✅ validacaoSenha.js carregado"))
        .catch(err => console.error("❌ Erro ao importar validacaoSenha.js:", err));
    });
  });

  incluir("modalAvisoContainer", "componentes/modalAviso.html");

  incluir("rodape", "componentes/rodape.html", () => {
    const hoje = new Date();
    const inicial = new Date(hoje.getFullYear(), 0, 1);
    const final = hoje;

    const dataInicialEl = document.getElementById("dataInicial");
    const dataFinalEl = document.getElementById("dataFinal");

    if (dataInicialEl) dataInicialEl.textContent = inicial.toLocaleDateString();
    if (dataFinalEl) dataFinalEl.textContent = final.toLocaleDateString();
  });
});
