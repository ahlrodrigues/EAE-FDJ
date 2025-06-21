/**
 * Carrega os caminhos absolutos dos arquivos de anotações da pasta do usuário.
 * Usa a função exposta pelo preload: window.api.listarArquivosNotas()
 * 
 * @returns {Promise<string[]>} Lista de caminhos completos
 */
export async function carregarArquivosNotas() {
  if (!window.api?.listarArquivosNotas) {
    console.warn("⚠️ Função 'listarArquivosNotas' não está disponível no preload.");
    return [];
  }

  try {
    const arquivos = await window.api.listarArquivosNotas();

    if (!Array.isArray(arquivos)) {
      console.error("❌ Valor retornado não é uma lista:", arquivos);
      return [];
    }

    console.log(`📁 ${arquivos.length} arquivo(s) de notas encontrados.`);
    arquivos.forEach((arq, i) => console.log(`  [${i + 1}] → ${arq}`));

    return arquivos;

  } catch (erro) {
    console.error("❌ Erro ao carregar arquivos de notas:", erro);
    return [];
  }
}
