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
  const dataInicio = new Date(2025, 5, 1); // 1º de junho de 2025

  const mesesDecorridos =
    (ano - dataInicio.getFullYear()) * 12 +
    (mes - dataInicio.getMonth());

  let edicaoAtual = baseEdicao + mesesDecorridos;
  let edicaoTentativa = edicaoAtual + 1;

  console.log(`📅 Edição base calculada: ${edicaoAtual}`);
  console.log(`🔄 Verificando se a próxima edição ${edicaoTentativa} já está disponível...`);

  // Verifica se a próxima edição está disponível
  const capaProxima = await tentarBuscarCapa(edicaoTentativa);
  if (capaProxima) {
    edicaoAtual = edicaoTentativa;
    console.log(`✅ Edição ${edicaoAtual} disponível!`);
  } else {
    console.log(`🕒 Edição ${edicaoTentativa} ainda não publicada. Usando ${edicaoAtual}.`);
  }

  // Agora tenta buscar a capa da edição final decidida
  const urlCapa = await tentarBuscarCapa(edicaoAtual);
  if (!urlCapa) {
    container.innerHTML = `<p>⚠️ Nenhuma capa encontrada para a edição ${edicaoAtual}.</p>`;
    return;
  }

  const urlPdf = `https://alianca.org.br/site/wp-content/uploads/arquivosotrevo/${edicaoAtual}-Trevo.pdf`;

  container.innerHTML = `
    <a href="${urlPdf}" target="_blank">
      <img src="${urlCapa}" alt="Capa da Revista O Trevo"
        style="width:60%; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.2);" />
    </a>
    <p style="text-align: center; font-size: 0.9rem;">Edição ${edicaoAtual}</p>
  `;

  console.log(`📘 Capa da edição ${edicaoAtual} exibida com sucesso.`);
}

// Testa se uma das imagens esperadas existe
async function tentarBuscarCapa(edicao) {
  const baseUrl = `https://alianca.org.br/site/trevo/${edicao}/images/`;
  const nomesPossiveis = ["capa_edicao.jpg", "capa.jpg"];

  for (const nome of nomesPossiveis) {
    const url = `${baseUrl}${nome}`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        console.log(`✅ Capa encontrada: ${url}`);
        return url;
      } else {
        console.log(`❌ Não encontrada: ${url}`);
      }
    } catch (e) {
      console.warn(`⚠️ Erro ao testar ${url}:`, e.message);
    }
  }

  return null; // Nenhuma imagem encontrada
}
