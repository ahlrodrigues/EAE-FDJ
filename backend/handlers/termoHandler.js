const path = require("path");
const fs = require("fs/promises");

function registrarTermoHandler(ipcMain) {
  ipcMain.handle("ler-termo-md", async (event, idioma) => {
    const idiomaFormatado = idioma.replace("_", "-");
    const filePath = path.join(__dirname, "../../frontend/locales", `termo_${idiomaFormatado}.md`);
    console.log("📄 Buscando termo em:", filePath);

    try {
      const conteudo = await fs.readFile(filePath, "utf8");
      return conteudo;
    } catch (erro) {
      console.error("❌ Erro ao ler termo markdown:", erro.message);
      throw new Error("Termo não encontrado para o idioma: " + idiomaFormatado);
    }
  });
}

// 🎯 Adiciona evento ao botão "Aceitar e Prosseguir"
const btnAceitar = document.getElementById("btnAceitar");
const checkboxAceite = document.getElementById("checkboxAceite");

if (btnAceitar && checkboxAceite) {
  btnAceitar.addEventListener("click", async () => {
    const aceite = checkboxAceite.checked;

    // ❌ Se não marcado, exibe aviso (modal se possível)
    if (!aceite) {
      if (window.api?.exibirAviso) {
        await window.api.exibirAviso({
          tipo: "Aviso",
          mensagem: "Você precisa aceitar os termos antes de continuar."
        });
      } else {
        alert("Você precisa aceitar os termos antes de continuar.");
      }
      return;
    }

    try {
      // 💾 Salva o aceite no usuario.json
      await window.api.salvarAceite?.();
      console.log("✅ Termo aceito salvo com sucesso.");

      // ✅ Fecha a janela do termo
      await window.api.fecharJanela?.();
    } catch (erro) {
      console.error("❌ Erro ao salvar aceite:", erro);
      await window.api.exibirAviso?.({
        tipo: "Erro",
        mensagem: "Não foi possível salvar o aceite. Tente novamente."
      });
    }
  });
} else {
  console.warn("⚠️ Elementos #btnAceitar ou #checkboxAceite não encontrados.");
}


  
module.exports = { registrarTermoHandler };
