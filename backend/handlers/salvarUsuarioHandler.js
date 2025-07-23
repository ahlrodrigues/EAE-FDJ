const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

function registrarSalvarUsuarioHandler() {
  ipcMain.handle("salvar-usuario", async (event, dados) => {
    const arquivo = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );

    try {
      const emailHash = Object.keys(dados.usuarios || {})[0];
      if (!emailHash) throw new Error("Campo 'emailHash' ausente");

      // 📄 Lê dados existentes
      let dadosExistentes = {};
      if (fs.existsSync(arquivo)) {
        dadosExistentes = JSON.parse(fs.readFileSync(arquivo, "utf-8"));
      }
      if (!dadosExistentes.usuarios) dadosExistentes.usuarios = {};

      // 🛠️ Atualiza os campos preservando os anteriores
      dadosExistentes.usuarios[emailHash] = {
        ...dadosExistentes.usuarios[emailHash],
        ...dados.usuarios[emailHash],
      };

      fs.writeFileSync(arquivo, JSON.stringify(dadosExistentes, null, 2), "utf-8");
      console.log("✅ Dados do usuário atualizados com sucesso:", emailHash);
      return { sucesso: true };

    } catch (erro) {
      console.error("❌ Erro ao atualizar usuário:", erro.message);
      return { sucesso: false, erro: erro.message };
    }
  });
}

module.exports = { registrarSalvarUsuarioHandler };
