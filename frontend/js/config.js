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

  const fs = window.nativo.fs;
  const path = window.nativo.path;
  const os = window.nativo.os;
  const descriptografar = window.nativo.descriptografarComMestra;
  const criptografar = window.nativo.criptografarComMestra;

  const usuarioPath = path.join(
    os.homedir(),
    ".config",
    "escola-aprendizes",
    "config",
    "usuario.json"
  );

  let dados;
  try {
    const raw = fs.readFileSync(usuarioPath, "utf-8");
    dados = JSON.parse(raw);
    console.log("📂 Dados do usuário carregados.");
  } catch (erro) {
    console.error("❌ Erro ao ler usuario.json:", erro.message);
    exibirAviso({ tipo: "erro", mensagem: "Erro ao carregar os dados do usuário." });
    return;
  }

  const usuario = dados.usuarios?.[0];
  if (!usuario) {
    console.warn("⚠️ Nenhum usuário encontrado.");
    return;
  }

  // 🔓 Descriptografar e preencher os campos
  const preencherCampo = (id, valorCriptografado) => {
    try {
      const campo = document.getElementById(id);
      if (campo && valorCriptografado) {
        campo.value = descriptografar(valorCriptografado);
        console.log(`🔓 Campo ${id} preenchido com valor descriptografado.`);
      }
    } catch (erro) {
      console.warn(`⚠️ Erro ao descriptografar ${id}:`, erro.message);
    }
  };

  preencherCampo("aluno", usuario.aluno);
  preencherCampo("email", usuario.emailCriptografado);
  preencherCampo("telefone", usuario.telefone);
  preencherCampo("codigoTemas", usuario.codigoTemas); // ✅ incluso

  // idioma (não criptografado)
  const idiomaEl = document.getElementById("idioma");
  if (idiomaEl && usuario.idioma) {
    idiomaEl.value = usuario.idioma;
  }

  // 💾 Evento de salvamento
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      usuario.aluno = criptografar(document.getElementById("aluno").value.trim());
      usuario.emailCriptografado = criptografar(document.getElementById("email").value.trim());
      usuario.telefone = criptografar(document.getElementById("telefone").value.trim());
      usuario.codigoTemas = criptografar(document.getElementById("codigoTemas").value.trim()); // 🔁 recriptografado
      usuario.idioma = document.getElementById("idioma").value;

      fs.writeFileSync(usuarioPath, JSON.stringify(dados, null, 2));
      console.log("✅ Configurações salvas com sucesso.");
      exibirAviso({ tipo: "sucesso", mensagem: "Configurações atualizadas com sucesso!" });

    } catch (erro) {
      console.error("❌ Erro ao salvar as configurações:", erro.message);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao salvar as configurações." });
    }
  });
});
