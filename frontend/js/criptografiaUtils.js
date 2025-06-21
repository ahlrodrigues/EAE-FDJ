export async function descriptografarComSecret(textoCriptografado) {
    try {
      if (!window.api?.descriptografarComMestra) {
        console.warn("⚠️ API de descriptografia não disponível.");
        return null;
      }
  
      const resultado = await window.api.descriptografarComMestra(textoCriptografado);
      console.log("🔓 Texto descriptografado.");
      return resultado;
    } catch (erro) {
      console.error("❌ Erro ao descriptografar com secret:", erro);
      return null;
    }
  }
  