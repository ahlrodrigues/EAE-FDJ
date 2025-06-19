// js/relatorio.js
import { exibirAviso } from "./modalAviso.js";
import { carregarArquivosNotas } from "../../backend/servicos/notasService.js";
import {
  extrairDataDoNome,
  formatarData,
  ordenarPorDataDesc,
  inicializarDataTable
} from "./utils/dataUtils.js";

// Carrega anotações da pasta criptografada
async function carregarAnotacoes() {
  try {
    const arquivos = await carregarArquivosNotas();
    const tbody = document.querySelector("#tabelaAnotacoes tbody");
    tbody.innerHTML = "";

    const dataInicio = document.getElementById("filtroDataInicio").value;
    const dataFim = document.getElementById("filtroDataFim").value;

    const linhas = [];

    for (const nome of arquivos) {
      const data = extrairDataDoNome(nome);
      console.log(`🔍 ${nome} → ${data}`);

      if (!data) continue;

      if (dataInicio && new Date(data) < new Date(dataInicio)) continue;
      if (dataFim && new Date(data) > new Date(dataFim)) continue;

      linhas.push({ nome, data });
    }

    const ordenadas = ordenarPorDataDesc(linhas);
    let contador = 1;

    for (const item of ordenadas) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" data-nome="${item.nome}"></td>
        <td>${contador++}</td>
        <td>${formatarData(item.data)}</td>
      `;
      tbody.appendChild(tr);
    }

    // Inicializa DataTable com ordenação e tradução
    inicializarDataTable("#tabelaAnotacoes");

    console.log("📋 Total de anotações exibidas:", ordenadas.length);
  } catch (erro) {
    console.error("❌ Erro ao carregar anotações:", erro);
    exibirAviso({ tipo: "Erro", mensagem: "Não foi possível carregar as anotações." });
  }
}

// Eventos
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("filtroDataInicio").addEventListener("change", carregarAnotacoes);
  document.getElementById("filtroDataFim").addEventListener("change", carregarAnotacoes);

  document.getElementById("selecionarTodosAnotacoes").addEventListener("change", e => {
    const checkboxes = document.querySelectorAll("#tabelaAnotacoes tbody input[type='checkbox']");
    checkboxes.forEach(cb => cb.checked = e.target.checked);
  });

  carregarAnotacoes();
});
