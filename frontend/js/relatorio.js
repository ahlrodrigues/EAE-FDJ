// === RELATORIO.JS ===
// 🔄 Carrega e exibe as anotações no DataTable

import { exibirAviso } from "./modalAviso.js";
import { carregarArquivosNotas } from "../../backend/servicos/notasService.js";
import {
  extrairDataDoNome,
  formatarData,
  ordenarPorDataDesc,
  inicializarDataTable
} from "./utils/dataUtils.js";

// 📌 Carrega e exibe a tabela
async function carregarAnotacoes() {
  try {
    console.log("🔄 Iniciando carregamento de anotações...");
    const arquivos = await carregarArquivosNotas();

    if (!Array.isArray(arquivos)) {
      throw new Error("Erro ao recuperar lista de arquivos.");
    }

    const tbody = document.querySelector("#tabelaAnotacoes tbody");
    if (!tbody) return console.error("❌ tbody não encontrado.");
    tbody.innerHTML = "";

    const dataInicio = document.getElementById("filtroDataInicio")?.value;
    const dataFim = document.getElementById("filtroDataFim")?.value;

    const linhas = arquivos.map(caminho => {
      const nome = caminho.split("/").pop();
      const data = extrairDataDoNome(nome);
      if (!data) return null;
      const dataObj = new Date(data);
      return { caminho, data: dataObj };
    }).filter(item =>
      item &&
      (!dataInicio || item.data >= new Date(dataInicio)) &&
      (!dataFim || item.data <= new Date(dataFim))
    );

    const ordenadas = ordenarPorDataDesc(linhas);
    let contador = 1;

    for (const item of ordenadas) {
      const tr = document.createElement("tr");
      tr.dataset.caminho = item.caminho;
      tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td>${contador++}</td>
        <td>${formatarData(item.data)}</td>
      `;
      tbody.appendChild(tr);
    }

    inicializarDataTable("#tabelaAnotacoes");

    // Ajusta layout da barra de controles do DataTable
    setTimeout(() => {
      const wrapper = $('#tabelaAnotacoes_wrapper');
      const length = wrapper.find('.dataTables_length');
      const filter = wrapper.find('.dataTables_filter');
      const label = filter.find('label');
      const input = label.find('input');
      label.html('<span style="margin-right: 6px;">Pesquisa:</span>');
      label.append(input);
      input.css({ width: '180px', padding: '6px' });

      const container = $('<div class="barra-controles"></div>');
      const esquerda = $('<div class="barra-esquerda"></div>').append(length);
      const direita = $('<div class="barra-direita"></div>').append(filter);
      container.append(esquerda).append(direita);
      wrapper.prepend(container);
    }, 0);

    console.log(`✅ Tabela com ${ordenadas.length} anotações carregada.`);
  } catch (erro) {
    console.error("❌ Erro ao carregar anotações:", erro);
    exibirAviso({ tipo: "Erro", mensagem: "Não foi possível carregar as anotações." });
  }
}

// 📂 Modal de leitura das anotações
document.getElementById("btnVerAnotacoes").addEventListener("click", async () => {
  const linhas = Array.from(document.querySelectorAll("#tabelaAnotacoes tbody input[type=checkbox]:checked"));
  if (!linhas.length) return alert("Selecione pelo menos uma anotação para visualizar.");

  const caminhos = linhas.map(cb => cb.closest("tr").dataset.caminho);
  const criptografados = await window.api.lerAnotacoesSelecionadas(caminhos);

  const resultados = await Promise.all(
    criptografados.map(async texto => {
      try {
        return await window.api.descriptografarComMestra(texto);
      } catch {
        return "[Erro ao descriptografar]";
      }
    })
  );

  const conteudoDiv = document.getElementById("modalAnotacoesConteudo");
  conteudoDiv.innerHTML = "";

  resultados.forEach(texto => {
    const bloco = document.createElement("div");
    bloco.innerHTML = `
      <div style="padding: 1rem; background: #f8f8f8; border-radius: 6px; margin-bottom: 1.5rem;">
        <div style="text-align: center;"><img src="../assets/trevo.png" alt="Trevo" style="max-height: 60px;" /></div>
        <pre style="white-space: pre-wrap; color: #444; font-size: 1.1rem; line-height: 1.6;">${texto}</pre>
      </div>
    `;
    conteudoDiv.appendChild(bloco);
  });

  document.getElementById("modalAnotacoes").style.display = "flex";
});

document.getElementById("modalAnotacoesFechar").addEventListener("click", () => {
  document.getElementById("modalAnotacoes").style.display = "none";
});

// ▶️ Inicializa relatório e abas
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("filtroDataInicio")?.addEventListener("change", carregarAnotacoes);
  document.getElementById("filtroDataFim")?.addEventListener("change", carregarAnotacoes);

  const selecionarTodos = document.getElementById("selecionarTodosAnotacoes");
  selecionarTodos?.addEventListener("change", e => {
    document.querySelectorAll("#tabelaAnotacoes tbody input[type='checkbox']")
      .forEach(cb => cb.checked = e.target.checked);
  });

  ativarAbaPorHash();
  carregarAnotacoes();

  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => ativarAba(button.dataset.tab));
  });
});

window.addEventListener("hashchange", ativarAbaPorHash);

// === SUBMENU ===

export function configurarLinksSubmenu() {
  const links = document.querySelectorAll('.link-submenu');
  if (!links.length) return;

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      if (tab) ativarAba(tab);
    });
  });
}

function ativarAba(tab) {
  if (!tab) return;
  const botao = document.querySelector(`.tab-button[data-tab="${tab}"]`);
  const aba = document.getElementById(tab);
  if (!botao || !aba) return;

  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  botao.classList.add('active');
  aba.classList.add('active');
  document.querySelector('.submenu')?.classList.remove('open');
  window.history.pushState(null, '', `#${tab}`);
}

function ativarAbaPorHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash) ativarAba(hash);
}
