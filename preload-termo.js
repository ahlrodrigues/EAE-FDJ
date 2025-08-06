// reload-termo.js

const { contextBridge, ipcRenderer } = require("electron");

console.log("📥 [PRELOAD-TERMO] preload-termo.js carregado.");

contextBridge.exposeInMainWorld("api", {
  // 📄 Ler o termo markdown para exibir no termo.html
  lerTermoMarkdown: (idioma) => {
    console.log("📄 [PRELOAD-TERMO] Solicitando conteúdo do termo em:", idioma);
    return ipcRenderer.invoke("ler-termo-md", idioma);
  },

  // ✅ Envia evento ao processo principal indicando que o termo foi aceito
  enviarTermoAceito: () => {
    console.log("📤 [PRELOAD-TERMO] Enviando evento 'termo-aceito' ao processo principal");
    ipcRenderer.send("termo-aceito");
  },

  // 💾 Salva o aceite no usuario.json
  salvarAceite: () => {
    console.log("💾 [PRELOAD-TERMO] Solicitando salvamento do aceite no usuario.json");
    return ipcRenderer.invoke("salvar-aceite");
  },

  // 🧪 Exibe aviso via modal reutilizável (se necessário no termo)
  exibirAviso: (mensagem) => {
    console.log("⚠️ [PRELOAD-TERMO] Exibindo aviso:", mensagem);
    return ipcRenderer.invoke("exibir-aviso", mensagem);
  }
});

ipcRenderer.on("termo-aceito", (_, dados) => {
  console.log("📥 [PRELOAD] Evento 'termo-aceito' recebido no preload principal");
  if (typeof termoAceitoCallback === "function") {
    termoAceitoCallback();
    console.log("✅ [PRELOAD] Callback do termo executado com sucesso.");
  } else {
    console.warn("❌ [PRELOAD] Callback do termo não está definido.");
  }
});
