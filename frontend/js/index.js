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
    const descriptografar = window.nativo.descriptografarComMestra; // ✅ Atribuição direta para facilitar

    const usuarioPath = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );

  });
});
