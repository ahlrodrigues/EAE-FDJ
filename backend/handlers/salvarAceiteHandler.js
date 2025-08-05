// backend/handlers/salvarAceiteHandler.js

const { ipcMain } = require("electron");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const os = require("os");

function registrarSalvarAceiteHandler() {
  ipcMain.handle("salvar-aceite", async () => {
    const pastaConfig = path.join(os.homedir(), ".config", "escola-aprendizes");
    const caminhoUsuario = path.join(pastaConfig, "usuario.json");

    try {
      let dados = { usuarios: {} };

      // 📂 Se o arquivo existir, lemos seu conteúdo
      if (fs.existsSync(caminhoUsuario)) {
        console.log("📄 usuario.json encontrado. Lendo conteúdo...");
        const conteudo = await fsPromises.readFile(caminhoUsuario, "utf-8");
        dados = JSON.parse(conteudo);
      } else {
        console.warn("⚠️ usuario.json ainda não existe.");
      }

      // 🧠 Captura o primeiro usuário registrado
      const primeiroEmailHash = Object.keys(dados.usuarios)[0];
      if (!primeiroEmailHash) {
        throw new Error("Nenhum usuário encontrado para salvar o aceite.");
      }

      if (!dados.usuarios[primeiroEmailHash]) {
        throw new Error(`Dados do usuário "${primeiroEmailHash}" não encontrados.`);
      }

      // ✅ Atualiza o campo de aceite
      dados.usuarios[primeiroEmailHash].aceiteTermos = true;
      console.log(`📌 Aceite registrado para usuário: ${primeiroEmailHash}`);

      // 💾 Salva o novo estado do JSON
      await fsPromises.writeFile(caminhoUsuario, JSON.stringify(dados, null, 2), "utf-8");
      console.log("✅ Aceite salvo com sucesso no usuario.json");

      return { sucesso: true };
    } catch (erro) {
      console.error("❌ Erro ao salvar aceite:", erro.message);
      throw erro;
    }
  });
}

module.exports = { registrarSalvarAceiteHandler };
