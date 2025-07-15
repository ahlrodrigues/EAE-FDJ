import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { lerUsuario, salvarUsuario } from './utils/usuarioConfig.js';

const emailHash = window.api.obterEmailHash();

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;

  const form = document.getElementById("formAnotacao");
  const dataEl = document.getElementById("data");
  const toggle = document.getElementById("modoToggle");
  const label = document.getElementById("modoLabel");

  // Sugere data atual
  const hoje = new Date().toISOString().split("T")[0];
  dataEl.value = hoje;

  // Foca no campo data se sinalizado no localStorage
  if (localStorage.getItem("focarCampoData") === "sim") {
    dataEl.focus();
    localStorage.removeItem("focarCampoData");
  }

  // Inicializa o modo preenchimento
  const usuario = await lerUsuario();
  const modo = usuario.modoPreenchimento || 'separado';
  const usarBloco = modo === 'unico';

  toggle.checked = usarBloco;
  label.textContent = usarBloco ? 'Modo bloco de texto' : 'Modo estruturado por campos';
  alternarFormulario(usarBloco);

  toggle.addEventListener('change', async (e) => {
    const usarBloco = e.target.checked;
    label.textContent = usarBloco
      ? 'Modo bloco de texto'
      : 'Modo estruturado por campos';

    alternarFormulario(usarBloco);

    const usuario = await lerUsuario();
    usuario.modoPreenchimento = usarBloco ? 'unico' : 'separado';
    await salvarUsuario(usuario);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usarBloco = toggle.checked;

    const dados = usarBloco
      ? {
          data: dataEl.value,
          textoUnico: document.getElementById("textoUnico").value.trim()
        }
      : {
          data: dataEl.value,
          fato: document.getElementById("fato").value.trim(),
          acao: document.getElementById("acao").value.trim(),
          sentimento: document.getElementById("sentimento").value.trim(),
          proposta: document.getElementById("proposta").value.trim()
        };

    let nome = await window.api.obterNomeAlunoDescriptografado();
    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      nome = "usuario";
    }

    const agora = new Date();
    const hora = `${String(agora.getSeconds()).padStart(2, "0")}-${String(agora.getMinutes()).padStart(2, "0")}-${String(agora.getHours()).padStart(2, "0")}`;
    const nomeArquivo = `${dados.data}-${hora}_${nome}.txt`;

    const [ano, mes, dia] = dados.data.split("-");
    const dataFormatada = `${dia}-${mes}-${ano}`;

    const conteudo = usarBloco
      ? `Data: ${dataFormatada}\n\n${dados.textoUnico}`
      : `
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

        // Limpa campos sem recarregar
        if (usarBloco) {
          document.getElementById("textoUnico").value = "";
        } else {
          document.getElementById("fato").value = "";
          document.getElementById("acao").value = "";
          document.getElementById("sentimento").value = "";
          document.getElementById("proposta").value = "";
        }

        localStorage.setItem("focarCampoData", "sim");
        dataEl.value = hoje;
        dataEl.focus();
      } else {
        exibirAviso({ tipo: "erro", mensagem: resultado.erro || "Erro ao salvar anotação." });
      }
    } catch (erro) {
      console.error("❌ Erro ao salvar anotação:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao salvar anotação." });
    }
  });
});

// Alterna entre os dois formulários
function alternarFormulario(usarTextoUnico) {
  document.getElementById("formularioSeparado").classList.toggle("hidden", usarTextoUnico);
  document.getElementById("formularioTextoUnico").classList.toggle("hidden", !usarTextoUnico);
}
