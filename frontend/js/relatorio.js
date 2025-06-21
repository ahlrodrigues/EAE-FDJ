import { exibirAviso } from "./modalAviso.js";
import { carregarArquivosNotas } from "../../backend/servicos/notasService.js";
import {
  extrairDataDoNome,
  formatarData,
  ordenarPorDataDesc,
  inicializarDataTable
} from "./utils/dataUtils.js";

// 📌 Carrega e exibe anotações da pasta criptografada
async function carregarAnotacoes() {
  try {
    console.log("🔄 Iniciando carregamento de anotações...");
    const arquivos = await carregarArquivosNotas(); // <-- deve retornar caminhos completos
    console.log("📁 Arquivos encontrados:", arquivos);

    const tbody = document.querySelector("#tabelaAnotacoes tbody");
    tbody.innerHTML = "";

    const dataInicio = document.getElementById("filtroDataInicio").value;
    const dataFim = document.getElementById("filtroDataFim").value;

    const linhas = [];

    for (const caminho of arquivos) {
      const nome = caminho.split("/").pop(); // ex: 2025-06-19-29-32-18_Sandra_Maria.txt
      const data = extrairDataDoNome(nome);
      console.log(`🔍 Arquivo: ${nome} → Data extraída: ${data}`);

      if (!data) {
        console.warn(`⚠️ Nome de arquivo fora do padrão esperado: ${nome}`);
        continue;
      }

      // 🧭 Filtro por data
      if (dataInicio && new Date(data) < new Date(dataInicio)) continue;
      if (dataFim && new Date(data) > new Date(dataFim)) continue;

      linhas.push({ caminho, data });
    }

    const ordenadas = ordenarPorDataDesc(linhas);
    console.log("📊 Arquivos após ordenação:", ordenadas.map(l => l.caminho));

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
    console.log("✅ Tabela carregada com", ordenadas.length, "anotações");

  } catch (erro) {
    console.error("❌ Erro ao carregar anotações:", erro);
    exibirAviso({
      tipo: "Erro",
      mensagem: "Não foi possível carregar as anotações."
    });
  }
}

// ✅ Eventos e inicialização
window.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM carregado. Inicializando tela de Anotações...");

  document.getElementById("filtroDataInicio").addEventListener("change", carregarAnotacoes);
  document.getElementById("filtroDataFim").addEventListener("change", carregarAnotacoes);

  document.getElementById("selecionarTodosAnotacoes").addEventListener("change", e => {
    const checkboxes = document.querySelectorAll("#tabelaAnotacoes tbody input[type='checkbox']");
    checkboxes.forEach(cb => cb.checked = e.target.checked);
    console.log(`✅ ${checkboxes.length} checkboxes ${e.target.checked ? "selecionados" : "deselecionados"}`);
  });

  carregarAnotacoes();
});
