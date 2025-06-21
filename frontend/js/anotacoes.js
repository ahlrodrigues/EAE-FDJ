import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;

  const form = document.getElementById("formAnotacao");
  const dataEl = document.getElementById("data");

  // Sugere data atual
  const hoje = new Date().toISOString().split("T")[0];
  dataEl.value = hoje;

  // Foca no campo data se sinalizado no localStorage
  if (localStorage.getItem("focarCampoData") === "sim") {
    dataEl.focus();
    localStorage.removeItem("focarCampoData");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      data: dataEl.value,
      fato: document.getElementById("fato").value.trim(),
      acao: document.getElementById("acao").value.trim(),
      sentimento: document.getElementById("sentimento").value.trim(),
      proposta: document.getElementById("proposta").value.trim()
    };

    let nome = await window.api.obterNomeAlunoDescriptografado();
    if (!nome) nome = "usuario";

    const dataParte = dados.data.replace(/-/g, "-");
    const agora = new Date();
    const hora = `${String(agora.getSeconds()).padStart(2, "0")}-${String(agora.getMinutes()).padStart(2, "0")}-${String(agora.getHours()).padStart(2, "0")}`;
    const nomeArquivo = `${dataParte}-${hora}_${nome}.txt`;

    const conteudo = `
Data: ${dados.data}
Fato: ${dados.fato}
Ação/Reação: ${dados.acao}
Sentimento: ${dados.sentimento}
Proposta Renovadora: ${dados.proposta}
`.trim();

    try {
      const resultado = await window.api.salvarAnotacao(conteudo, nomeArquivo);
      if (resultado.sucesso) {
        await exibirAviso({ tipo: "✅ Sucesso", mensagem: "Anotação salva com sucesso." });

        // Sinaliza para focar o campo ao recarregar
        localStorage.setItem("focarCampoData", "sim");
        window.location.reload(); // Recarrega a página para ambiente limpo
      } else {
        exibirAviso({ tipo: "erro", mensagem: resultado.erro || "Erro ao salvar anotação." });
      }
    } catch (erro) {
      console.error("❌ Erro ao salvar anotação:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao salvar anotação." });
    }
  });
});
