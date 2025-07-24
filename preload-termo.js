const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  lerTermoMarkdown: (idioma) => ipcRenderer.invoke("ler-termo-md", idioma),
});

contextBridge.exposeInMainWorld("electronAPI", {
  enviarAceite: () => ipcRenderer.send("termo-aceito"),
});
