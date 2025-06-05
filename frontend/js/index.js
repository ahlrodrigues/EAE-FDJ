// js/index.js

window.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOM completamente carregado.');
  console.log('📦 Iniciando leitura dos dados do usuário...');

  try {
    const resultado = await window.api.lerUsuario();
    console.log('📁 Conteúdo bruto de usuario.json:', resultado);

    const usuario = resultado.usuarios?.[0];

    if (!usuario) {
      console.warn('⚠️ Nenhum usuário encontrado. Redirecionando para login...');
      window.location.href = 'login.html';
      return;
    }

    console.log('🧾 Usuário lido com sucesso (criptografado):', usuario);

    // Tenta descriptografar o campo codigoTemas
    if (usuario.codigoTemas) {
      try {
        const codigoTemas = await window.api.descriptografarComMestra(usuario.codigoTemas);
        console.log('🔓 codigoTemas descriptografado com sucesso:', codigoTemas);

        // ⚠️ Gatilho para carregar os dados da planilha
        if (codigoTemas) {
          carregarMensagensPlanilha(codigoTemas);
        } else {
          console.warn('⚠️ codigoTemas descriptografado está vazio.');
        }

      } catch (erro) {
        console.error('❌ Erro ao descriptografar codigoTemas:', erro.message || erro);
      }
    } else {
      console.warn('⚠️ Campo codigoTemas não encontrado no JSON do usuário.');
    }

  } catch (erro) {
    console.error('❌ Erro ao carregar dados do usuário:', erro.message || erro);
  }
});
