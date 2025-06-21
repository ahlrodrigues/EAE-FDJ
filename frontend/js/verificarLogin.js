/**
 * Verifica as credenciais de login do usuário.
 * @param {string} email - Email do usuário.
 * @param {string} senha - Senha fornecida.
 * @returns {Promise<{sucesso: boolean, erro?: string}>}
 */
export async function verificarLogin(email, senha) {
  try {
    if (!window.api?.validarLogin) {
      console.warn("⚠️ API de login não está disponível no preload.");
      return { sucesso: false, erro: "API de login indisponível." };
    }

    console.log("🔐 Verificando login para:", email);
    const resultado = await window.api.validarLogin(email, senha);
    console.log("✅ Resultado da verificação:", resultado);

    return resultado;
  } catch (erro) {
    console.error("❌ Erro inesperado ao verificar login:", erro);
    return { sucesso: false, erro: "Erro interno ao verificar login." };
  }
}
