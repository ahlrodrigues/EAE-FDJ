const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // 📄 Ler o termo markdown para exibir no termo.html
  lerTermoMarkdown: (idioma) => ipcRenderer.invoke("ler-termo-md", idioma),

  // ✅ Envia evento ao processo principal indicando que o termo foi aceito
  enviarTermoAceito: () => ipcRenderer.send("termo-aceito"),

  // 🧪 Modal reutilizável, se necessário no termo
  exibirAviso: (mensagem) => ipcRenderer.invoke("exibir-aviso", mensagem)
});
