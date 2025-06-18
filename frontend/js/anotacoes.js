import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;

  const form = document.getElementById("formAnotacao");
  const dataEl = document.getElementById("data");

  // Sugere data atual
  const hoje = new Date().toISOString().split("T")[0];
  dataEl.value = hoje;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      data: dataEl.value,
      fato: document.getElementById("fato").value.trim(),
      acao: document.getElementById("acao").value.trim(),
      sentimento: document.getElementById("sentimento").value.trim(),
      proposta: document.getElementById("proposta").value.trim()
    };

    let nome = window.api?.obterNomeUsuario?.();
if (!nome) nome = "usuario";

// Sanitize: remover caracteres perigosos
nome = nome.replace(/[^\w\-]/g, "_");
    if (!nome) {
      exibirAviso({ tipo: "erro", mensagem: "Usuário não identificado." });
      return;
    }

    const conteudo = `
🗓️ Data: ${dados.data}
📌 Fato: ${dados.fato}
🔁 Ação/Reação: ${dados.acao}
❤️ Sentimento: ${dados.sentimento}
💡 Proposta Renovadora: ${dados.proposta}
`.trim();

    const agora = new Date();
    const nomeArquivo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}-${String(agora.getHours()).padStart(2, "0")}-${String(agora.getMinutes()).padStart(2, "0")}-${String(agora.getSeconds()).padStart(2, "0")}_${nome}.txt`;

    try {
      const resultado = await window.api.salvarAnotacao(conteudo, nomeArquivo);
      if (resultado.sucesso) {
        exibirAviso({ tipo: "✅ Sucesso", mensagem: "Anotação salva com sucesso." });
        form.reset();
        dataEl.value = hoje;
      } else {
        exibirAviso({ tipo: "erro", mensagem: resultado.erro || "Erro ao salvar anotação." });
      }
    } catch (erro) {
      console.error("❌ Erro ao salvar anotação:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao salvar anotação." });
    }
  });
});
