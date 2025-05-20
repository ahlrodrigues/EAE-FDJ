document.addEventListener("DOMContentLoaded", () => {
  const incluir = async (id, caminho, callback) => {
    try {
      const resp = await fetch(caminho);
      const html = await resp.text();
      document.getElementById(id).innerHTML = html;
      if (callback) callback();
    } catch (erro) {
      console.error(`❌ Erro ao incluir ${caminho}:`, erro);
    }
  };

  incluir("cabecalho", "componentes/cabecalho.html");
  incluir("senhaRegrasContainer", "componentes/senhaRegras.html");
  incluir("modalAvisoContainer", "componentes/modalAviso.html");
  incluir("rodape", "componentes/rodape.html", () => {
    const hoje = new Date();
    const inicial = new Date(hoje.getFullYear(), 0, 1);
    const final = hoje;
    document.getElementById("dataInicial").textContent = inicial.toLocaleDateString();
    document.getElementById("dataFinal").textContent = final.toLocaleDateString();
  });
});
