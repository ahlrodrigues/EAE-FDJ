// js/incluirComponentes.js
import { inicializarCabecalho } from "../js/rodape";
import { inicializarRodape } from "../js/rodape";

// Inclui HTML externo em container por ID
export function incluir(id, caminho, aoFinalizar) {
  fetch(caminho)
    .then(resp => resp.text())
    .then(html => {
      const container = document.getElementById(id);
      if (container) {
        container.innerHTML = html;
        if (aoFinalizar) aoFinalizar();
        console.log(`✅ Componente incluído em #${id}: ${caminho}`);
      } else {
        console.warn(`⚠️ Elemento #${id} não encontrado para incluir ${caminho}`);
      }
    })
    .catch(err => console.error(`❌ Erro ao carregar ${caminho}:`, err));
}

// Inicializa cabeçalho e rodapé
export function carregarComponentesFixos() {
  console.log("🔧 Carregando cabeçalho e rodapé...");
  inicializarCabecalho();
  inicializarRodape();
}
