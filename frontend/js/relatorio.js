import { exibirAviso } from "./modalAviso.js";
import { carregarArquivosNotas } from "../../backend/servicos/notasService.js";
import {
  extrairDataDoNome,
  formatarData,
  ordenarPorDataDesc,
  inicializarDataTable
} from "./utils/dataUtils.js";

// 📌 Carrega e exibe as anotações disponíveis
async function carregarAnotacoes() {
  try {
    console.log("🔄 Iniciando carregamento de anotações...");

    const arquivos = await carregarArquivosNotas();
    if (!Array.isArray(arquivos)) {
      console.error("❌ Resultado inválido:", arquivos);
      throw new Error("Erro ao recuperar lista de arquivos.");
    }

    console.log("📁 Arquivos encontrados:", arquivos);

    const tbody = document.querySelector("#tabelaAnotacoes tbody");
    if (!tbody) {
      console.error("❌ Elemento tbody da tabela não encontrado.");
      return;
    }
    tbody.innerHTML = "";

    const dataInicio = document.getElementById("filtroDataInicio")?.value;
    const dataFim = document.getElementById("filtroDataFim")?.value;
    console.log(`📆 Filtro: Início = ${dataInicio || "sem filtro"}, Fim = ${dataFim || "sem filtro"}`);

    const linhas = [];

    for (const caminho of arquivos) {
      const nome = caminho.split("/").pop();
      const data = extrairDataDoNome(nome);
      console.log(`🔍 Analisando: ${nome} → Data extraída: ${data}`);

      if (!data) {
        console.warn(`⚠️ Nome fora do padrão: ${nome}`);
        continue;
      }

      const dataObj = new Date(data);
      if (dataInicio && dataObj < new Date(dataInicio)) continue;
      if (dataFim && dataObj > new Date(dataFim)) continue;

      linhas.push({ caminho, data: dataObj });
    }

    const ordenadas = ordenarPorDataDesc(linhas);
    console.log("📊 Ordenadas:", ordenadas.map(l => l.caminho));

    let contador = 1;
    for (const item of ordenadas) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" data-caminho="${item.caminho}"></td>
        <td>${contador++}</td>
        <td>${formatarData(item.data)}</td>
      `;
      tbody.appendChild(tr);
    }

    inicializarDataTable("#tabelaAnotacoes");
    console.log(`✅ Tabela com ${ordenadas.length} anotações carregada.`);
  } catch (erro) {
    console.error("❌ Erro ao carregar:", erro);
    exibirAviso({
      tipo: "Erro",
      mensagem: "Não foi possível carregar as anotações."
    });
  }
}

// ▶️ Botão "Ver" — exibe a anotação diretamente no modal
document.getElementById("btnVerAnotacoes")?.addEventListener("click", async () => {
  console.log("📥 Clique em 'Ver' detectado.");

  const checkboxes = document.querySelectorAll("#tabelaAnotacoes tbody input[type='checkbox']:checked");
  const selecionadas = [...checkboxes];

  if (selecionadas.length === 0) {
    exibirAviso({ tipo: "Aviso", mensagem: "Selecione uma anotação para visualizar." });
    return;
  }

  if (selecionadas.length > 1) {
    exibirAviso({ tipo: "Aviso", mensagem: "Por favor, selecione apenas uma anotação por vez." });
    return;
  }

  const caminho = selecionadas[0].dataset.caminho;

  try {
    const resultado = await window.api.lerArquivo(caminho);

    if (resultado?.sucesso) {
      document.getElementById("modalAnotacoesConteudo").textContent = resultado.conteudo;
      exibirModal("modalAnotacoes");
    } else {
      const msg = resultado?.erro || "Erro desconhecido ao ler anotação.";
      exibirAviso({ tipo: "Erro", mensagem: msg });
    }

  } catch (erro) {
    console.error("❌ Erro inesperado ao ler anotação:", erro);
    exibirAviso({ tipo: "Erro", mensagem: "Não foi possível carregar o conteúdo da anotação." });
  }
});




// ✅ Inicialização da página do relatório
window.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM pronto. Iniciando relatório...");

  document.getElementById("filtroDataInicio")?.addEventListener("change", carregarAnotacoes);
  document.getElementById("filtroDataFim")?.addEventListener("change", carregarAnotacoes);

  const selecionarTodos = document.getElementById("selecionarTodosAnotacoes");
  if (selecionarTodos) {
    selecionarTodos.addEventListener("change", e => {
      const checkboxes = document.querySelectorAll("#tabelaAnotacoes tbody input[type='checkbox']");
      checkboxes.forEach(cb => cb.checked = e.target.checked);
      console.log(`🔁 ${checkboxes.length} checkboxes ${e.target.checked ? "selecionados" : "deselecionados"}`);
    });
  }

  carregarAnotacoes();
});
