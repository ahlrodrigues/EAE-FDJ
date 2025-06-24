import { componentesCarregados } from "./incluirComponentes.js";
import { incluirCartoes } from "./incluirCartoes.js";
import { buscarMensagensDoDirigente } from "./mensagensDirigente.js";
import { buscarMensagemAleatoria } from "./mensagemAleatoria.js";
import { carregarUltimoVideo } from "./carregarUltimoVideo.js";

// ⏳ Aguarda todos os componentes estarem prontos
componentesCarregados.then(async () => {
  console.log("📦 Componentes carregados. Iniciando aplicação...");

  await incluirCartoes();
  console.log("🧩 Cartões HTML incluídos.");

  try {
    const fs = window.nativo.fs;
    const path = window.nativo.path;
    const os = window.nativo.os;

    const usuarioPath = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );

    console.log("📁 Verificando existencia de:", usuarioPath);

    const existe = await window.nativo.arquivoExiste("usuario.json");
    if (!existe) {
      throw new Error("❌ Arquivo usuario.json não encontrado.");
    }

    const raw = await fs.readFile(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);

    const chaves = Object.keys(dados.usuarios || {});
    if (chaves.length === 0) {
      throw new Error("⚠️ Nenhum usuário encontrado.");
    }

    const usuario = dados.usuarios[chaves[0]];
    console.log("📄 Usuário carregado com sucesso:", usuario);

    if (typeof window.api?.descriptografarComMestra !== "function") {
      throw new Error("❌ API de descriptografia não disponível.");
    }

    const codigoTemas = await window.api.descriptografarComMestra(usuario.codigoTemas);
    console.log("🔓 codigoTemas descriptografado:", codigoTemas);

    // 🔄 Carrega conteúdo dinâmico com base na planilha
    await buscarMensagensDoDirigente(codigoTemas);
    await buscarMensagemAleatoria(codigoTemas);
    await carregarUltimoVideo();

  } catch (erro) {
    console.error("❌ Erro na leitura do código de temas:", erro.message);
    const container = document.getElementById("mensagem-dirigente");
    if (container) {
      container.textContent = "Erro ao carregar as mensagens.";
    }
  }
});
