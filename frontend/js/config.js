import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;

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

  const emailHashLogado = sessionStorage.getItem("emailHash");

  if (!emailHashLogado) {
    exibirAviso({ tipo: "erro", mensagem: "Usuário não autenticado." });
    return;
  }

  let dadosUsuarios;
  try {
    const raw = fs.readFileSync(usuarioPath, "utf-8");
    const json = JSON.parse(raw);
    dadosUsuarios = json.usuarios || [];
  } catch (erro) {
    console.error("❌ Erro ao ler usuario.json:", erro);
    exibirAviso({ tipo: "erro", mensagem: "Erro ao carregar os dados." });
    return;
  }

  const usuario = dadosUsuarios.find(u => u.emailHash === emailHashLogado);
  if (!usuario) {
    exibirAviso({ tipo: "erro", mensagem: "Usuário não encontrado." });
    return;
  }

  // Preenche os campos, se existirem no HTML
  const preencher = (id, valorCriptografado) => {
    const el = document.getElementById(id);
    if (el) el.value = descriptografar(valorCriptografado || "");
  };

  preencher("email", usuario.emailCriptografado);
  preencher("aluno", usuario.aluno);
  preencher("casaEspírita", usuario.casaEspírita);
  preencher("codigoTemas", usuario.codigoTemas);
  preencher("numeroTurma", usuario.numeroTurma);
  preencher("dirigente", usuario.dirigente);
  preencher("emailDirigente", usuario.emailDirigente);
  preencher("secretarios", usuario.secretarios);
  preencher("telefone", usuario.telefone);

  const idiomaEl = document.getElementById("idioma");
  if (idiomaEl) idiomaEl.value = usuario.idioma || "pt";

  console.log("✅ Dados do usuário carregados para edição.");

  // Salvamento
  const form = document.getElementById("formUsuario");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    try {
      const atualizar = (id, destino) => {
        const el = document.getElementById(id);
        if (el) usuario[destino] = criptografar(el.value.trim());
      };

      atualizar("aluno", "aluno");
      atualizar("casaEspírita", "casaEspírita");
      atualizar("codigoTemas", "codigoTemas");
      atualizar("numeroTurma", "numeroTurma");
      atualizar("dirigente", "dirigente");
      atualizar("emailDirigente", "emailDirigente");
      atualizar("secretarios", "secretarios");
      atualizar("telefone", "telefone");

      if (idiomaEl) usuario.idioma = idiomaEl.value;

      fs.writeFileSync(usuarioPath, JSON.stringify({ usuarios: dadosUsuarios }, null, 2), "utf-8");

      console.log("💾 Alterações salvas com sucesso.");
      exibirAviso({ tipo: "sucesso", mensagem: "Dados atualizados com sucesso!" });
    } catch (erro) {
      console.error("❌ Erro ao salvar alterações:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao salvar os dados." });
    }
  });
});
