// verNota.js

const modal = document.getElementById("modalAnotacoes");
const conteudo = document.getElementById("modalAnotacoesConteudo");
const btnFechar = document.getElementById("modalAnotacoesFechar");

// 🧭 Extrai os caminhos da URL
const params = new URLSearchParams(window.location.search);
const caminhos = params.getAll("caminho");

async function exibirAnotacoes() {
  if (!conteudo || !modal) {
    console.error("❌ Elementos do modal não encontrados.");
    return;
  }

  if (caminhos.length === 0) {
    console.warn("⚠️ Nenhum caminho recebido na URL.");
    conteudo.innerHTML = "<p>Nenhuma anotação foi selecionada.</p>";
    modal.style.display = "flex";
    return;
  }

  console.log("📦 Caminhos recebidos:", caminhos);

  for (const caminho of caminhos) {
    try {
      const resultado = await window.api.lerArquivo(caminho);
      if (!resultado || !resultado.sucesso) throw new Error("Erro na leitura");

      const texto = await window.api.descriptografarNota(resultado.conteudo);
      if (!texto) throw new Error("Texto descriptografado inválido");

      const bloco = document.createElement("div");
      bloco.classList.add("bloco-nota");
      bloco.innerHTML = `
        <h4>📝 ${caminho.split("/").pop()}</h4>
        <pre>${texto}</pre>
        <hr>
      `;
      conteudo.appendChild(bloco);

    } catch (erro) {
      console.error("❌ Erro ao processar anotação:", caminho, erro);
      const erroMsg = document.createElement("p");
      erroMsg.textContent = `Erro ao carregar ${caminho}`;
      conteudo.appendChild(erroMsg);
    }
  }

  modal.style.display = "flex";
}

btnFechar?.addEventListener("click", () => {
  // Apenas fecha o modal, não a janela inteira
  const modal = document.getElementById("modalAnotacoes");
  if (modal) modal.style.display = "none";
});

// Inicia o processo quando o DOM estiver pronto
window.addEventListener("DOMContentLoaded", exibirAnotacoes);
