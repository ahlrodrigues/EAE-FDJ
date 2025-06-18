const fs = require("fs");
const path = require("path");
const os = require("os");
const { criptografarComMestra } = require("../lib/criptografia");

function registrarNotasHandler(ipcMain) {
  ipcMain.handle("salvar-anotacao", async (_, conteudo, nomeArquivo) => {
    console.log("📝 [MAIN] Pedido para salvar anotação recebido.");

    try {
      const usuarioPath = path.join(
        os.homedir(),
        ".config",
        "escola-aprendizes",
        "config",
        "usuario.json"
      );

      if (!fs.existsSync(usuarioPath)) {
        console.error("❌ Arquivo usuario.json não encontrado.");
        return { sucesso: false, erro: "Usuário não encontrado." };
      }

      const dados = JSON.parse(fs.readFileSync(usuarioPath, "utf-8"));
      const usuario = dados.usuarios?.[0];

      if (!usuario || !usuario.emailHash) {
        console.error("❌ emailHash não encontrado no usuário.");
        return { sucesso: false, erro: "Usuário inválido." };
      }

      const destino = path.join(
        os.homedir(),
        ".config",
        "escola-aprendizes",
        "notas",
        usuario.emailHash
      );

      if (!fs.existsSync(destino)) {
        fs.mkdirSync(destino, { recursive: true });
        console.log("📂 Pasta de anotações criada:", destino);
      }

      const conteudoCriptografado = criptografarComMestra(conteudo, process.env.CRYPTO_SECRET);

      const caminhoFinal = path.join(destino, nomeArquivo);
      fs.writeFileSync(caminhoFinal, conteudoCriptografado, "utf-8");

      console.log("✅ Anotação salva com sucesso em:", caminhoFinal);
      return { sucesso: true };
    } catch (erro) {
      console.error("❌ Erro ao salvar anotação:", erro);
      return { sucesso: false, erro: "Erro ao salvar anotação." };
    }
  });
}

module.exports = { registrarNotasHandler };
