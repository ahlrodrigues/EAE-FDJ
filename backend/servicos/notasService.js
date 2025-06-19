// servicos/notasService.js

export async function carregarArquivosNotas() {
    if (!window.api?.listarArquivosNotas) {
      console.warn("⚠️ Função listarArquivosNotas não está disponível no preload.");
      return [];
    }
  
    try {
      const arquivos = await window.api.listarArquivosNotas();
      console.log("📁 Arquivos de notas carregados:", arquivos);
      return arquivos;
    } catch (erro) {
      console.error("❌ Erro ao carregar arquivos de notas:", erro);
      return [];
    }
  }
  