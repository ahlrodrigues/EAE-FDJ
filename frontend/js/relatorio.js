import { exibirAviso } from "./modalAviso.js";
import { carregarArquivosNotas } from "../../backend/servicos/notasService.js";
import {
  extrairDataDoNome,
  formatarData,
  ordenarPorDataDesc,
  inicializarDataTable
} from "./utils/dataUtils.js";

// 📌 Carrega e exibe as anotações disponíveis na tabela
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
      tr.dataset.caminho = item.caminho; // 🔐 Caminho será usado para visualização
      tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td>${contador++}</td>
        <td>${formatarData(item.data)}</td>
      `;
      tbody.appendChild(tr);
    }

    inicializarDataTable("#tabelaAnotacoes");
    console.log(`✅ Tabela com ${ordenadas.length} anotações carregada.`);
  } catch (erro) {
    console.error("❌ Erro ao carregar anotações:", erro);
    exibirAviso({
      tipo: "Erro",
      mensagem: "Não foi possível carregar as anotações."
    });
  }
}

// ▶️ Botão "Ver" — exibe as anotações descriptografadas no modal
document.getElementById("btnVerAnotacoes").addEventListener("click", async () => {
  const linhasSelecionadas = Array.from(document.querySelectorAll("#tabelaAnotacoes tbody input[type=checkbox]:checked"));
  if (linhasSelecionadas.length === 0) {
    alert("Selecione pelo menos uma anotação para visualizar.");
    return;
  }

  const caminhos = linhasSelecionadas.map(cb => cb.closest("tr").dataset.caminho);
  console.log("📂 Caminhos selecionados:", caminhos);

  if (caminhos.some(c => !c)) {
    alert("❌ Caminho inválido em uma ou mais anotações.");
    return;
  }

  try {
    const criptografados = await window.api.lerAnotacoesSelecionadas(caminhos);
    console.log("🔐 Conteúdos criptografados recebidos:", criptografados);

    const resultados = await Promise.all(
      criptografados.map(async (textoCript) => {
        try {
          const textoPlano = await window.api.descriptografarComMestra(textoCript);
          return textoPlano;
        } catch (erro) {
          console.warn("⚠️ Erro ao descriptografar anotação:", erro.message);
          return "[Erro ao descriptografar]";
        }
      })
    );

    const conteudoDiv = document.getElementById("modalAnotacoesConteudo");
    conteudoDiv.innerHTML = "";

    resultados.forEach((anotacao, idx) => {
      const bloco = document.createElement("div");
      bloco.innerHTML = `
        <div style="text-align: left; padding: 1rem; background: #f8f8f8; border-radius: 6px; box-shadow: 0 0 4px rgba(0,0,0,0.1); margin-bottom: 1rem;">
          <strong style="color: #333;">Anotação ${idx + 1}</strong>
          <pre style="white-space: pre-wrap; margin-top: 0.5rem; color: #444;">${anotacao}</pre>
        </div>
      `;
      conteudoDiv.appendChild(bloco);
    });

    document.getElementById("modalAnotacoes").style.display = "flex";

  } catch (erro) {
    console.error("❌ Erro ao ler anotações:", erro);
    alert("Erro ao ler as anotações.");
  }
});

// ❌ Fecha o modal de anotações
document.getElementById("modalAnotacoesFechar").addEventListener("click", () => {
  document.getElementById("modalAnotacoes").style.display = "none";
});

// ✅ Inicialização do relatório
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
