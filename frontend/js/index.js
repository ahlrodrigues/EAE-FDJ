// ============================================================================
// Caminho: ./frontend/js/index.js
// Objetivo: Carregar dados para as abas a partir do NOVO modelo por usuário.
// Mudanças:
//  - Remove leitura direta de ~/.config/.../usuario.json (LEGADO).
//  - Usa window.usuarioAPI.lerAtual() → MAIN resolve a sessão (session:emailHash).
//  - Descriptografa codigoTemas via window.api.descriptografarComMestra.
//  - Logs e mensagens amigáveis em caso de falha.
// ============================================================================
import { componentesCarregados } from "./incluirComponentes.js";
import { incluirCartoes } from "./incluirCartoes.js";
import { buscarMensagensDoDirigente } from "./mensagensDirigente.js";
import { buscarMensagemAleatoria } from "./mensagemAleatoria.js";
// import { carregarUltimoVideo } from "./carregarUltimoVideo.js";
import { carregarVideoAleatorio } from "./carregarVideoAleatorio.js";

const LOG = "🏁[index]";

async function carregarCodigoTemasDaSessao() {
  // 1) Pede ao preload o usuário atual (MAIN → session:emailHash → usuario:ler)
  const resp = await window.usuarioAPI.lerAtual();
  if (!resp?.ok) {
    throw new Error(resp?.erro || "Falha ao obter usuário da sessão.");
  }

  const usuario = resp.dados || {};
  // Esperado: campo 'codigoTemas' cifrado (string AES-GCM base64)
  const cifrado = usuario.codigoTemas;
  if (!cifrado) {
    throw new Error("Campo 'codigoTemas' ausente no cadastro do usuário. Configure em Configurações.");
  }

  // 2) Descriptografa no backend (mantém segredo no MAIN)
  const plano = await window.api.descriptografarComMestra(cifrado);
  if (!plano) {
    throw new Error("Não foi possível descriptografar 'codigoTemas'.");
  }

  console.log(`${LOG} codigoTemas OK (len=${plano.length}).`);
  return { codigoTemas: plano, usuario };
}

componentesCarregados.then(async () => {
  console.log(`${LOG} Componentes carregados. Iniciando aplicação...`);

  await incluirCartoes();
  console.log(`${LOG} Cartões HTML incluídos.`);

  try {
    // 🚫 Sai: leitura de usuario.json (legado)
    // ✅ Entra: leitura via IPC por sessão (novo modelo)
    const { codigoTemas } = await carregarCodigoTemasDaSessao();

    // Abas/dados do index
    await buscarMensagensDoDirigente(codigoTemas);
    await buscarMensagemAleatoria(codigoTemas);
    // await carregarUltimoVideo();
    await carregarVideoAleatorio();

    console.log(`${LOG} Página inicial carregada com sucesso.`);
  } catch (erro) {
    console.error(`${LOG} Erro ao preparar conteúdo:`, erro.message);

    // Caso típico: usuário não configurou o código de integração
    if (/codigoTemas/i.test(String(erro?.message || "")) && window.api?.exibirAviso) {
      try {
        await window.api.exibirAviso({
          tipo: "Configuração necessária",
          mensagem: "Falta o código de integração das atividades (planilha). Abra Configurações e informe o campo “Código das atividades”.",
        });
        window.location.href = "config.html";
        return;
      } catch {}
    }

    // Feedback visual mínimo nos cartões
    const msgDir = document.getElementById("mensagem-dirigente");
    if (msgDir) msgDir.textContent = "Erro ao carregar as mensagens.";

    const msgRnd = document.getElementById("mensagem-randomica");
    if (msgRnd) msgRnd.textContent = "Erro ao carregar a mensagem edificante.";

    // Opcional: usar modalAviso, se existir no seu app
    if (window.api?.exibirAviso) {
      window.api.exibirAviso(`Falha ao carregar conteúdo inicial: ${erro.message}`);
    }
  }
});
