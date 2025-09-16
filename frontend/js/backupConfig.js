// ============================================================================
// Caminho: ./frontend/js/backupConfig.js
// Objetivo: carregar/salvar configurações de backup e controlar visibilidade.
// Alterações desta versão:
//  - REMOVE o botão "Desconectar" da área de ações (evita duplicidade).
//  - Mantém o status persistente; quem alterna rótulos agora é o backupUI.js
//  - NÃO pré-seleciona o serviço; não altera o quadro de modos.
// Logs: 🧩 [backupConfig]
// ============================================================================

const LOG = "🧩 [backupConfig]";

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
function on(el, ev, fn, opts) {
  if (!el) { console.warn(`${LOG} Elemento inexistente para on('${ev}')`); return; }
  el.addEventListener(ev, fn, opts);
}
function modalOk(titulo, mensagem) {
  try {
    if (window.modalAviso?.abrir) return window.modalAviso.abrir({ titulo, mensagem, tipo: "sucesso", icone: "✅", autoFecharMs: 3000 });
    if (window.abrirModalAviso) return window.abrirModalAviso({ titulo, mensagem, tipo: "sucesso", icone: "✅", autoFecharMs: 3000 });
  } catch {}
  console.log(`✅ ${titulo}: ${mensagem}`);
}
function modalInfo(titulo, mensagem) {
  try {
    if (window.modalAviso?.abrir) return window.modalAviso.abrir({ titulo, mensagem, tipo: "info", icone: "ℹ️", autoFecharMs: 2500 });
    if (window.abrirModalAviso) return window.abrirModalAviso({ titulo, mensagem, tipo: "info", icone: "ℹ️", autoFecharMs: 2500 });
  } catch {}
  console.log(`ℹ️ ${titulo}: ${mensagem}`);
}
function modalErro(titulo, mensagem) {
  try {
    if (window.modalAviso?.abrir) return window.modalAviso.abrir({ titulo, mensagem, tipo: "erro", icone: "❌" });
    if (window.abrirModalAviso) return window.abrirModalAviso({ titulo, mensagem, tipo: "erro", icone: "❌" });
  } catch {}
  console.error(`❌ ${titulo}: ${mensagem}`);
}

// ---------- Elementos ----------
let selServico, rowOAuth, btnConectar, oauthStatus, authCard;
let inpPastaRemota, ultimaInfo, rowAgendamento, inpHorario;
let btnSalvar, btnTestar, btnExecutar;

// ---------- Estado ----------
let cfgAtual = null;
let estadoConexao = { conectado: false, usuario: null };

// ---------- Inicialização ----------
document.addEventListener("DOMContentLoaded", () => {
  try {
    selServico     = $("backup-servico");
    rowOAuth       = $("oauth-row");
    btnConectar    = $("btnConectarGoogle");
    oauthStatus    = $("oauth-status");
    authCard       = $("authCodeCard");
    inpPastaRemota = $("backup-pasta-remota");
    ultimaInfo     = $("backup-ultima-info");
    rowAgendamento = $("agendamento-row");
    inpHorario     = $("backup-horario");

    btnSalvar   = $("btn-backup-salvar");
    btnTestar   = $("btn-backup-testar");
    btnExecutar = $("btn-backup-executar");

    on(selServico, "change", aplicarVisibilidadeServico);
    on(btnSalvar, "click", salvarConfiguracao);
    on(btnTestar, "click", testarConexao);
    on(btnExecutar, "click", executarAgora);

    document.querySelectorAll('input[name="backup-modo"]').forEach((el) => on(el, "change", aplicarVisibilidadeModo));

    carregarConfiguracao().then(async () => {
      aplicarVisibilidadeModo();
      await verificarConexaoPersistida();
      aplicarVisibilidadeServico();
    });
  } catch (e) {
    console.error(`${LOG} Falha durante DOMContentLoaded:`, e?.message || e);
  }
});

// ---------- Funções principais ----------
async function carregarConfiguracao() {
  try {
    if (!window.api?.backup?.carregarConfiguracao) throw new Error("API carregarConfiguracao indisponível.");
    const cfg = await window.api.backup.carregarConfiguracao();
    cfgAtual = cfg || {};
    console.log(`${LOG} Config carregada:`, cfgAtual);

    // NUNCA pré-selecionar serviço
    if (selServico) selServico.value = cfgAtual.servico || "";

    // Pasta remota (default visual)
    if (inpPastaRemota) inpPastaRemota.value = cfgAtual.pastaNome || inpPastaRemota.value || "EAEbackup";

    // Modo/horário
    const modo = cfgAtual.modo || "manual";
    const radio = document.querySelector(`input[name="backup-modo"][value="${modo}"]`);
    if (radio) radio.checked = true;
    if (inpHorario) inpHorario.value = cfgAtual.horario || inpHorario.value || "22:30";

    // Último backup
    if (ultimaInfo) ultimaInfo.textContent = `Último backup: ${cfgAtual.ultimoBackupISO || "—"}`;

    // Status abaixo do botão (texto inicial)
    if (oauthStatus && !oauthStatus.textContent?.trim()) oauthStatus.textContent = "Desconectado";

    // NÃO forçar texto do botão aqui (quem controla é backupUI.js)
  } catch (e) {
    console.error(`${LOG} ❌ Falha ao carregar cfg:`, e?.message || e);
  }
}

async function verificarConexaoPersistida() {
  try {
    const servGoogle = (cfgAtual?.servico || "") === "google-drive";
    const haToken = !!cfgAtual?.oauthTokenEnc;
    if (!servGoogle || !haToken) {
      estadoConexao = { conectado: false, usuario: null };
      return;
    }

    let r = null;
    if (window.api?.testarConexaoGoogle) r = await window.api.testarConexaoGoogle();
    else if (window.api?.backup?.testarConexao) r = await window.api.backup.testarConexao("google-drive");

    if (r?.ok) {
      estadoConexao = { conectado: true, usuario: r.user || "Conta Google" };
      setStatusConectado();
    } else {
      estadoConexao = { conectado: false, usuario: null };
      setStatusDesconectado("Desconectado");
    }
  } catch (e) {
    console.warn(`${LOG} Aviso ao verificar conexão persistida:`, e?.message || e);
    estadoConexao = { conectado: false, usuario: null };
    setStatusDesconectado("Desconectado");
  }
}

// ---------- Ações ----------
async function salvarConfiguracao() {
  try {
    if (!window.api?.backup?.salvarConfiguracao) throw new Error("API salvarConfiguracao indisponível.");

    const servico   = selServico?.value || "";
    const pastaNome = (inpPastaRemota?.value || "EAEbackup").trim();
    const modoEl    = document.querySelector('input[name="backup-modo"]:checked');
    const modo      = modoEl?.value || "manual";
    const horario   = (inpHorario?.value || "22:30").trim();

    const resp = await window.api.backup.salvarConfiguracao({ servico, pastaNome, modo, horario });
    if (!resp?.ok) throw new Error(resp?.erro || "Falha ao salvar configurações.");
    modalOk("Configurações salvas.", `Pasta remota: ${resp.remotePath || "/"+pastaNome}`);
  } catch (e) {
    modalErro("Erro ao salvar", e?.message || e);
  }
}

async function testarConexao() {
  try {
    let r = null;
    if (window.api?.testarConexaoGoogle) r = await window.api.testarConexaoGoogle();
    else if (window.api?.backup?.testarConexao) r = await window.api.backup.testarConexao("google-drive");
    else throw new Error("API de teste de conexão indisponível.");

    if (r?.ok) {
      estadoConexao = { conectado: true, usuario: r.user || "Conta Google" };
      setStatusConectado();
      modalOk("Conexão OK", `Usuário: ${estadoConexao.usuario}`);
    } else {
      estadoConexao = { conectado: false, usuario: null };
      setStatusDesconectado("Desconectado");
      throw new Error(r?.erro || r?.error || "Falha ao testar conexão.");
    }
  } catch (e) {
    modalErro("Erro no teste de conexão", e?.message || e);
  }
}

async function executarAgora() {
  try {
    if (!window.api?.backup?.executarAgora) throw new Error("API executarAgora indisponível.");
    const r = await window.api.backup.executarAgora();
    if (!r?.ok) throw new Error(r?.erro || "Falha no backup imediato.");

    if (ultimaInfo) ultimaInfo.textContent = `Último backup: ${r.quando || new Date().toISOString()}`;
    modalOk("Backup concluído", `Arquivos enviados: ${r.enviados || 0}\nOrigem: ${r.localDir || "-"}\nDestino: /${r.remotePath || "-"}`);
  } catch (e) {
    modalErro("Erro ao executar backup", e?.message || e);
  }
}

// ---------- UI: visibilidade ----------
function aplicarVisibilidadeServico() {
  const serv = selServico?.value || "";
  const usarGoogle = serv === "google-drive";

  if (rowOAuth) rowOAuth.style.display = usarGoogle ? "block" : "none";
  if (authCard) authCard.style.display = usarGoogle && !estadoConexao.conectado ? "block" : "none";

  if (!usarGoogle) setStatusDesconectado("Desconectado");
  else if (estadoConexao.conectado) setStatusConectado();
  else setStatusPendente("Aguardando conexão…");

  console.log(`${LOG} Visibilidade serviço → google-drive?`, usarGoogle, "| conectado?", estadoConexao.conectado);
}

function aplicarVisibilidadeModo() {
  const modoEl = document.querySelector('input[name="backup-modo"]:checked');
  const modo = modoEl?.value || "manual";
  if (rowAgendamento) rowAgendamento.style.display = modo === "agendado" ? "block" : "none";
  console.log(`${LOG} Visibilidade modo →`, modo);
}

// ---------- Status helpers ----------
function setStatusConectado() {
  if (oauthStatus) oauthStatus.textContent = "✅ Conectado ao Google Drive";
}
function setStatusDesconectado(texto = "Desconectado") {
  if (oauthStatus) oauthStatus.textContent = texto;
}
function setStatusPendente(texto = "Aguardando autorização…") {
  if (oauthStatus) oauthStatus.textContent = texto;
}
