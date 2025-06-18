// js/index.js
import { componentesCarregados } from "./incluirComponentes.js";
import { incluirCartoes } from "./incluirCartoes.js";
import { buscarMensagensDoDirigente } from "./mensagensDirigente.js";
import { buscarMensagemAleatoria } from "./mensagemAleatoria.js";
import { carregarUltimoVideo } from "./carregarUltimoVideo.js";

componentesCarregados.then(async () => {
  console.log("📦 Componentes carregados. Iniciando aplicação...");

  await incluirCartoes();
  console.log("🧩 Cartões HTML incluídos.");

  try {
    const fs = window.nativo.fs;
    const path = window.nativo.path;
    const os = window.nativo.os;

    const usuarioPath = path.join(os.homedir(), ".config", "escola-aprendizes", "config", "usuario.json");
    console.log("📁 Caminho do usuario.json:", usuarioPath);

    if (!fs.existsSync(usuarioPath)) {
      throw new Error("Arquivo usuario.json não encontrado.");
    }

    const raw = fs.readFileSync(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);
    const usuario = dados.usuarios?.[0];

    if (!usuario) {
      throw new Error("Nenhum usuário encontrado.");
    }

    console.log("📄 Usuário carregado com sucesso.");

    if (typeof window.api?.descriptografarComMestra !== "function") {
      throw new Error("API de descriptografia não disponível.");
    }

    const codigoTemas = await window.api.descriptografarComMestra(usuario.codigoTemas);
    console.log("🔓 codigoTemas descriptografado:", codigoTemas);

    // Chamada dos cartões com o código da planilha
    buscarMensagensDoDirigente(codigoTemas);
    buscarMensagemAleatoria(codigoTemas);
    carregarUltimoVideo();

  } catch (erro) {
    console.error("❌ Erro na leitura do código de temas:", erro.message);
    const container = document.getElementById("mensagem-dirigente");
    if (container) {
      container.textContent = "Erro ao carregar as mensagens.";
    }
  }
});
