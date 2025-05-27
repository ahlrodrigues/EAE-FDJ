import { componentesCarregados } from "./incluirComponentes.js";
import { incluirCartoes } from "./incluirCartoes.js";
import { buscarMensagensDoDirigente } from "./mensagensDirigente.js";
import { buscarMensagemAleatoria } from "./mensagemAleatoria.js";
import { carregarUltimoVideo } from "./carregarUltimoVideo.js";

componentesCarregados.then(() => {
  console.log("📦 Componentes carregados. Iniciando aplicação...");

  incluirCartoes().then(() => {
    console.log("🧩 Cartões HTML incluídos.");

    const fs = window.nativo.fs;
    const path = window.nativo.path;
    const os = window.nativo.os;
    const descriptografar = window.nativo.descriptografarComMestra;

    const usuarioPath = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );

    try {
      const raw = fs.readFileSync(usuarioPath, "utf-8");
      const dados = JSON.parse(raw);
      const usuario = dados.usuarios?.[0];

      if (usuario?.codigoTemas) {
        try {
          const codigoTemas = descriptografar(usuario.codigoTemas);
          console.log("📌 codigoTemas carregado:", codigoTemas);

          buscarMensagensDoDirigente(codigoTemas);
          buscarMensagemAleatoria(codigoTemas);
        } catch (e) {
          console.error("❌ Erro ao descriptografar codigoTemas:", e);
        }
      } else {
        console.warn("⚠️ Campo codigoTemas ausente ou inválido.");
      }

      carregarUltimoVideo();
    } catch (erro) {
      console.error("❌ Erro ao ler ou descriptografar usuario.json:", erro);
    }

  }); // ← fechamento do incluirCartoes().then()
}); // ← fechamento do componentesCarregados.then()
