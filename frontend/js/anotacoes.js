import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

const emailHash = window.api.obterEmailHash();

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;

  const form = document.getElementById("formAnotacao");
  const dataEl = document.getElementById("data");
  const toggle = document.getElementById("modoToggle");
  const label = document.getElementById("modoLabel");

  const hoje = new Date().toISOString().split("T")[0];
  dataEl.value = hoje;

  if (localStorage.getItem("focarCampoData") === "sim") {
    dataEl.focus();
    localStorage.removeItem("focarCampoData");
  }

  const usuario = await lerUsuarioJson();
  const modo = usuario.modoPreenchimento || "separado";
  const usarBloco = modo === "unico";

  toggle.checked = usarBloco;
  label.textContent = usarBloco ? "Modo bloco de texto" : "Modo estruturado por campos";
  alternarFormulario(usarBloco);

  toggle.addEventListener("change", async (e) => {
    const usarBloco = e.target.checked;
    label.textContent = usarBloco
      ? "Modo bloco de texto"
      : "Modo estruturado por campos";

    alternarFormulario(usarBloco);

    const usuario = await lerUsuarioJson();
    usuario.modoPreenchimento = usarBloco ? "unico" : "separado";
    await salvarUsuarioJson(usuario);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usarBloco = toggle.checked;

    // 🔍 Coleta os dados preenchidos
    const dados = usarBloco
      ? {
          data: dataEl.value,
          anotacaoLivre: document.getElementById("anotacaoLivre").value.trim(),
        }
      : {
          data: dataEl.value,
          fato: document.getElementById("fato").value.trim(),
          acao: document.getElementById("acao").value.trim(),
          sentimento: document.getElementById("sentimento").value.trim(),
          proposta: document.getElementById("proposta").value.trim(),
        };

    // 📛 Garante nome válido
    let nome = await window.api.obterNomeAlunoDescriptografado();
    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      nome = "usuario";
    }

    // 🕒 Gera nome do arquivo: YYYY-MM-DD-HH-MM-SS_nome.txt
    const agora = new Date();
    const hora = `${String(agora.getHours()).padStart(2, "0")}-${String(
      agora.getMinutes()
    ).padStart(2, "0")}-${String(agora.getSeconds()).padStart(2, "0")}`;
    const nomeArquivo = `${dados.data}-${hora}_${nome}.txt`;

    // 🧾 Conteúdo formatado
    const [ano, mes, dia] = dados.data.split("-");
    const dataFormatada = `${dia}-${mes}-${ano}`;

    const conteudo = usarBloco
      ? `Data: ${dataFormatada}\n\n${dados.anotacaoLivre}`
      : `
Data: ${dataFormatada}
Fato: ${dados.fato}
Ação/Reação: ${dados.acao}
Sentimento: ${dados.sentimento}
Proposta Renovadora: ${dados.proposta}`.trim();

    // 💾 Tenta salvar a anotação
    try {
      const resultado = await window.api.salvarAnotacao(conteudo, nomeArquivo);
      if (resultado.sucesso) {
        await exibirAviso({
          tipo: "✅ Sucesso",
          mensagem: "Anotação salva com sucesso.",
        });

        // 🧼 Limpa campos após salvar
        if (usarBloco) {
          document.getElementById("anotacaoLivre").value = "";
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
        exibirAviso({
          tipo: "erro",
          mensagem: resultado.erro || "Erro ao salvar anotação.",
        });
      }
    } catch (erro) {
      console.error("❌ Erro ao salvar anotação:", erro);
      exibirAviso({
        tipo: "erro",
        mensagem: "Erro ao salvar anotação.",
      });
    }
  });
});

// 🔁 Alterna entre formulários estruturado ou livre
function alternarFormulario(usarTextoUnico) {
  const bloco = document.getElementById("formularioLivre");
  const detalhado = document.getElementById("formularioDetalhado");

  bloco.style.display = usarTextoUnico ? "block" : "none";
  detalhado.style.display = usarTextoUnico ? "none" : "block";

  document.getElementById("anotacaoLivre").required = usarTextoUnico;
  document.getElementById("fato").required = !usarTextoUnico;
  document.getElementById("acao").required = !usarTextoUnico;
  document.getElementById("sentimento").required = !usarTextoUnico;
  document.getElementById("proposta").required = !usarTextoUnico;
}

// 🔍 Lê o conteúdo do arquivo usuario.json
async function lerUsuarioJson() {
  try {
    const caminho = window.api.getUserConfigPath();
    const conteudo = await window.api.lerArquivo(caminho);
    const dados = JSON.parse(conteudo);
    const usuarios = dados.usuarios || {};
    const primeiroHash = Object.keys(usuarios)[0];
    return usuarios[primeiroHash] || {};
  } catch (erro) {
    console.error("❌ Erro ao ler usuario.json:", erro);
    return {};
  }
}

// 💾 Salva preferências no usuario.json
async function salvarUsuarioJson(usuarioNovo) {
  try {
    const caminho = window.api.getUserConfigPath();
    const conteudo = await window.api.lerArquivo(caminho);
    const dados = JSON.parse(conteudo);
    const usuarios = dados.usuarios || {};
    const primeiroHash = Object.keys(usuarios)[0];

    usuarios[primeiroHash] = {
      ...usuarios[primeiroHash],
      ...usuarioNovo,
    };

    await window.api.salvarArquivo(caminho, JSON.stringify({ usuarios }, null, 2));
    return true;
  } catch (erro) {
    console.error("❌ Erro ao salvar usuario.json:", erro);
    return false;
  }
}
