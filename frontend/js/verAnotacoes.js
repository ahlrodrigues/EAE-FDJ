// js/verAnotacoes.js
import { descriptografarComSecret } from "./criptografiaUtils.js";

// 🔄 Função auxiliar: aguarda um elemento aparecer no DOM
async function esperarElemento(seletor, tentativas = 20, intervalo = 100) {
  console.log(`⏳ Aguardando elemento: ${seletor}`);
  for (let i = 0; i < tentativas; i++) {
    const el = document.querySelector(seletor);
    if (el) {
      console.log(`✅ Elemento encontrado: ${seletor}`);
      return el;
    }
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }
  console.error(`❌ Elemento ${seletor} não encontrado após ${tentativas} tentativas.`);
  return null;
}

// 🚀 Inicialização do script
(async () => {
  console.log("📦 verAnotacoes.js carregado");

  const btnVer = await esperarElemento("#btnVerAnotacoes");
  const modal = await esperarElemento("#modalAnotacoes");
  const modalConteudo = await esperarElemento("#modalAnotacoesConteudo");
  const btnFechar = await esperarElemento("#modalAnotacoesFechar");

  if (!btnVer || !modal || !modalConteudo) {
    console.error("❌ Elementos do modal não encontrados. Abortando.");
    return;
  }

  // 📌 Evento de clique no botão "Ver"
  btnVer.addEventListener("click", async () => {
    console.log("🟢 Botão 'Ver' clicado.");

    const checkboxes = document.querySelectorAll('#anotacoes input[type="checkbox"]:checked');
    console.log(`📦 Total de checkboxes selecionados: ${checkboxes.length}`);

    if (checkboxes.length === 0) {
      alert("Selecione ao menos uma anotação para visualizar.");
      return;
    }

    modalConteudo.innerHTML = ""; // limpa modal anterior

    for (const checkbox of checkboxes) {
      const caminho = checkbox.dataset.caminho;
      const nomeArquivo = caminho?.split("/").pop();

      console.log("📁 Lendo anotação:", caminho);

      try {
        const textoCriptografado = await window.api.lerArquivo(caminho);
        console.log("🔐 Texto criptografado carregado.");

        const texto = await descriptografarComSecret(textoCriptografado);
        console.log("🔓 Texto descriptografado com sucesso.");

        let dataFormatada = "Data inválida";
        const partes = nomeArquivo?.split("_")[0]?.split("-");
        if (partes?.length >= 5) {
          const [ano, mes, dia, hora, minuto] = partes;
          dataFormatada = `${dia}/${mes}/${ano} ${hora}:${minuto}`;
        } else {
          console.warn("⚠️ Nome do arquivo fora do padrão esperado:", nomeArquivo);
        }

        const bloco = `
          <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 10px;">
            <img src="../assets/trevo.png" alt="Trevo" style="height: 50px; display: block; margin: 0 auto;" />
            <p style="text-align: left; white-space: pre-wrap; font-size: 1rem;">${texto}</p>
          </div>
        `;
        modalConteudo.innerHTML += bloco;

      } catch (erro) {
        console.error("❌ Erro ao processar anotação:", nomeArquivo, erro);
        modalConteudo.innerHTML += `<div style="color:red; padding: 1rem;">Erro ao carregar: ${nomeArquivo}</div>`;
      }
    }

    // 🪟 Exibe o modal
    modal.style.display = "flex";
    console.log("🪟 Modal exibido.");
  });

  // 🔙 Botão de fechar modal
  btnFechar?.addEventListener("click", () => {
    modal.style.display = "none";
    console.log("🛑 Modal fechado.");
  });
})();
