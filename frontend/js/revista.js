document.addEventListener("DOMContentLoaded", () => {
  console.log("🔍 Iniciando verificação da revista...");
  buscarCapaRevistaComData();
});

async function buscarCapaRevistaComData() {
  const container = document.getElementById("revistaTrevoContainer");
  if (!container) {
    console.warn("⚠️ Elemento #revistaTrevoContainer não encontrado.");
    return;
  }

  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  const baseEdicao = 531;
  const dataInicio = new Date(2025, 5, 1); // 1º de junho de 2024

  const mesesDecorridos =
    (ano - dataInicio.getFullYear()) * 12 +
    (mes - dataInicio.getMonth());

  let edicaoAtual = baseEdicao + mesesDecorridos;
  let edicaoTentativa = edicaoAtual + 1;

  const urlCapaProxima = `https://alianca.org.br/site/trevo/${edicaoTentativa}/images/capa_edicao.jpg`;
  const urlPdfProxima = `https://alianca.org.br/site/wp-content/uploads/arquivosotrevo/${edicaoTentativa}-Trevo.pdf`;

  console.log(`📅 Edição base calculada: ${edicaoAtual}`);
  console.log(`🔄 Tentando verificar se a edição ${edicaoTentativa} já está disponível...`);

  try {
    const resProxima = await fetch(urlCapaProxima, { method: "HEAD" });

    if (resProxima.ok) {
      edicaoAtual = edicaoTentativa;
      console.log(`✅ Próxima edição ${edicaoTentativa} disponível! Usando ela.`);
    } else {
      console.log(`🕒 Próxima edição ${edicaoTentativa} ainda não publicada. Mantendo edição ${edicaoAtual}.`);
    }

    const urlCapa = `https://alianca.org.br/site/trevo/${edicaoAtual}/images/capa_edicao.jpg`;
    const urlPdf = `https://alianca.org.br/site/wp-content/uploads/arquivosotrevo/${edicaoAtual}-Trevo.pdf`;

    container.innerHTML = `
      <a href="${urlPdf}" target="_blank">
        <img src="${urlCapa}" alt="Capa da Revista O Trevo"
          style="width:60%; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.2);" />
      </a>
      <p style="text-align: center; font-size: 0.9rem;">Edição ${edicaoAtual}</p>
    `;

    console.log(`📘 Capa da edição ${edicaoAtual} exibida com sucesso.`);
  } catch (e) {
    container.innerHTML = `<p>⚠️ Erro ao buscar a capa da revista.</p>`;
    console.error("❌ Erro ao verificar capa:", e.message);
  }
}
