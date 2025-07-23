// js/config.js
import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;
  console.log("⚙️ Página de configuração carregada.");

  const form = document.getElementById("configForm");
  if (!form) {
    console.error("❌ Formulário #configForm não encontrado.");
    return;
  }

  const descriptografar = window.nativo.descriptografarComMestra;
  const criptografar = window.nativo.criptografarComMestra;

  let dados;
  try {
    dados = await window.api.lerUsuario();
    console.log("📂 Dados do usuário carregados com sucesso.");
  } catch (erro) {
    console.error("❌ Erro ao ler usuario.json:", erro.message);
    exibirAviso({ tipo: "erro", mensagem: "Erro ao carregar os dados do usuário." });
    return;
  }

  const usuario = Object.values(dados.usuarios || {})[0];
  if (!usuario) {
    console.warn("⚠️ Nenhum usuário encontrado.");
    return;
  }

  // 🗝️ Campos criptografados válidos (sem senha)
  const camposCriptografados = [
    "casaEspírita",
    "numeroTurma",
    "dirigente",
    "emailDirigente",
    "secretarios",
    "aluno",
    "emailCriptografado",
    "telefone",
    "codigoTemas"
  ];

  const preencherCampo = async (id, valorCriptografado) => {
    try {
      const campo = document.getElementById(id);
      if (campo && valorCriptografado) {
        campo.value = await descriptografar(valorCriptografado);
        console.log(`🔓 Campo '${id}' preenchido.`);
      }
    } catch (erro) {
      console.warn(`⚠️ Erro ao descriptografar campo '${id}':`, erro.message);
    }
  };

  // 🔄 Preencher todos os campos
  for (const campo of camposCriptografados) {
    const id = campo === "emailCriptografado" ? "email" : campo;
    await preencherCampo(id, usuario[campo]);
  }

  // 🌐 Campo idioma (não criptografado)
  const idiomaEl = document.getElementById("idioma");
  if (idiomaEl && usuario.idioma) {
    idiomaEl.value = usuario.idioma;
    console.log("🌐 Campo 'idioma' preenchido.");
  }

  // 💾 Evento de salvamento
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const emailHash = window.api.obterEmailHash();
      if (!emailHash) {
        console.error("❌ emailHash ausente. Abortando salvamento.");
        exibirAviso({
          tipo: "erro",
          mensagem: "Erro ao salvar: usuário não identificado."
        });
        return;
      }

      for (const campo of camposCriptografados) {
        const id = campo === "emailCriptografado" ? "email" : campo;
        const el = document.getElementById(id);
        if (el) {
          usuario[campo] = await criptografar(el.value.trim());
        }
      }
  
      usuario.idioma = idiomaEl?.value || "pt";
  
      // 🔐 Atualiza o objeto com a chave correta
      dados.usuarios[emailHash] = {
        ...dados.usuarios[emailHash], // preserva senha
        ...usuario                    // atualiza campos editados
      };
  
      await window.api.salvarUsuario(dados);
      console.log("✅ Configurações salvas com sucesso.");
      exibirAviso({
        tipo: "sucesso",
        mensagem: "Configurações atualizadas com sucesso!"
      });
  
    } catch (erro) {
      console.error("❌ Erro ao salvar as configurações:", erro.message);
      exibirAviso({
        tipo: "erro",
        mensagem: "Erro ao salvar as configurações."
      });
    }
  });
});