export async function verificarLogin(email, senha) {
    try {
      if (!window.api?.validarLogin) {
        throw new Error("API de login não está disponível.");
      }
  
      const resultado = await window.api.validarLogin(email, senha);
      return resultado;
    } catch (erro) {
      console.error("❌ Erro ao verificar login:", erro);
      return { sucesso: false, erro: "Erro interno ao verificar login." };
    }
  }
  