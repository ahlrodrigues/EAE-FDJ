import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
const emailHash = window.api.obterEmailHash();

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
    console.log("👤 Nome retornado do preload:", nome);
    
    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      console.warn("⚠️ Nome do aluno não encontrado, usando 'usuario'");
      nome = "usuario";
    }
    
    // 📁 Nome do arquivo (formato: YYYY-MM-DD-HH-MM-SS_nome.txt)
    const agora = new Date();
    const hora = `${String(agora.getSeconds()).padStart(2, "0")}-${String(agora.getMinutes()).padStart(2, "0")}-${String(agora.getHours()).padStart(2, "0")}`;
    const nomeArquivo = `${dados.data}-${hora}_${nome}.txt`;
    
    // 🗓️ Formata data para o conteúdo da nota: DD-MM-YYYY
    const [ano, mes, dia] = dados.data.split("-");
    const dataFormatada = `${dia}-${mes}-${ano}`;
    
    // ✍️ Conteúdo da anotação
    const conteudo = `
    Data: ${dataFormatada}
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
