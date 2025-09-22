// ============================================================================
// Caminho: backend/handlers/revistaHandler.js
// Objetivo: baixar/atualizar a capa da revista e expor caminho ao renderer
// Logs: 🗞️[HANDLER][REVISTA]
// Requisitos: node-fetch (ESM), Electron main process
// ============================================================================
const { ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");

// 🔄 ESM import p/ node-fetch com CommonJS
async function getFetch() {
  const { default: fetch } = await import("node-fetch");
  return fetch;
}

const LOG = "🗞️[HANDLER][REVISTA]";

// 📁 Caminhos (PADRÃO DO PROJETO): ~/.config/escola-aprendizes/revista/
function getPastaRevista() {
  const home = process.env.HOME || process.env.USERPROFILE || app.getPath("home") || "";
  return path.join(home, ".config", "escola-aprendizes", "revista");
}

function getCaminhoCapa(pasta) {
  return path.join(pasta, "capa.jpg"); // canonicalizamos SALVAR como capa.jpg
}

function getCaminhoControle(pasta) {
  return path.join(pasta, "ultima-edicao.json");
}

// ⏳ Timeout helper
function withTimeout(promise, ms, label = "request") {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`Timeout após ${ms}ms em ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// 🔍 Tenta HEAD (rápido). Se 405/403, tenta GET leve.
async function urlExiste(fetch, url) {
  const headers = { "User-Agent": "EAE-Revista/1.0 (+revistaHandler)" };
  try {
    const head = await withTimeout(fetch(url, { method: "HEAD", headers }), 6000, `HEAD ${url}`);
    if (head.ok) return true;
    // alguns servidores não permitem HEAD
    if (head.status === 405 || head.status === 403) {
      const get = await withTimeout(fetch(url, { method: "GET", headers }), 8000, `GET ${url}`);
      return get.ok;
    }
    return false;
  } catch (e) {
    console.warn(`${LOG} HEAD falhou para ${url}:`, e.message);
    try {
      const get = await withTimeout(fetch(url, { method: "GET", headers }), 8000, `GET ${url}`);
      return get.ok;
    } catch (e2) {
      console.warn(`${LOG} GET falhou para ${url}:`, e2.message);
      return false;
    }
  }
}

// 🔎 Busca a última edição disponível testando diferentes nomes de capa
async function descobrirUltimaEdicaoDisponivel({ base = 531, maxTentativas = 30 } = {}) {
  const fetch = await getFetch();
  let edicao = base;
  let ultimaValida = null;
  let nomeCapaValido = null;

  const nomesPossiveis = ["capa.jpg", "capa_edicao.jpg"];

  for (let i = 0; i < maxTentativas; i++) {
    let encontradaNestaEdicao = false;

    for (const nome of nomesPossiveis) {
      const url = `https://alianca.org.br/site/trevo/${edicao}/images/${nome}`;
      console.log(`${LOG} 🔍 Verificando: ${url}`);
      const existe = await urlExiste(fetch, url);
      if (existe) {
        console.log(`${LOG} ✅ Edição ${edicao} encontrada com ${nome}`);
        ultimaValida = edicao;
        nomeCapaValido = nome;
        encontradaNestaEdicao = true;
        break;
      } else {
        console.log(`${LOG} ❌ Não encontrada: ${url}`);
      }
    }

    if (!encontradaNestaEdicao) {
      // Paramos no primeiro "buraco" — evita avançar indefinidamente em caso de erro de numeração
      break;
    }
    edicao++;
  }

  if (ultimaValida && nomeCapaValido) {
    return { edicao: ultimaValida, nomeCapa: nomeCapaValido };
  }
  throw new Error("Nenhuma edição válida encontrada no intervalo pesquisado.");
}

// 🧠 Verifica e baixa a capa mais recente; salva controle
async function verificarAtualizacaoCapaEmSegundoPlano({ base = 531, maxTentativas = 30 } = {}) {
  const pasta = getPastaRevista();
  const caminhoCapa = getCaminhoCapa(pasta);
  const caminhoControle = getCaminhoControle(pasta);

  console.log(`${LOG} 🔄 Verificando nova capa…`);
  console.log(`${LOG} 📁 Pasta: ${pasta}`);
  fs.mkdirSync(pasta, { recursive: true });

  let edicaoAnterior = null;
  if (fs.existsSync(caminhoControle)) {
    try {
      const json = JSON.parse(fs.readFileSync(caminhoControle, "utf-8"));
      edicaoAnterior = json?.edicao ?? null;
      console.log(`${LOG} Controle anterior: edição=${edicaoAnterior}`);
    } catch (e) {
      console.warn(`${LOG} ⚠️ Erro ao ler controle:`, e.message);
    }
  }

  try {
    const { edicao, nomeCapa } = await descobrirUltimaEdicaoDisponivel({ base, maxTentativas });

    if (edicao === edicaoAnterior && fs.existsSync(caminhoCapa)) {
      console.log(`${LOG} 📗 Já temos a última edição (ed=${edicao}).`);
      return;
    }

    const url = `https://alianca.org.br/site/trevo/${edicao}/images/${nomeCapa}`;
    const fetch = await getFetch();
    console.log(`${LOG} ⬇️ Baixando capa: ${url}`);
    const res = await withTimeout(fetch(url, { headers: { "User-Agent": "EAE-Revista/1.0" } }), 12000, `Download ${url}`);

    if (!res.ok) {
      console.warn(`${LOG} ❌ Falha no download (status ${res.status})`);
      return;
    }

    const buffer = await res.buffer();
    fs.writeFileSync(caminhoCapa, buffer);
    console.log(`${LOG} ✅ Nova capa salva em: ${caminhoCapa}`);

    fs.writeFileSync(
      caminhoControle,
      JSON.stringify({ edicao, nomeCapa, atualizado: new Date().toISOString() }, null, 2)
    );
    console.log(`${LOG} 📝 Controle atualizado em: ${caminhoControle}`);
  } catch (e) {
    console.error(`${LOG} ❌ Erro durante atualização da capa:`, e.message);
  }
}

// 📥 Retorna o caminho local (como file://) para o renderer
function obterCaminhoCapaLocalFileURL() {
  const pasta = getPastaRevista();
  const caminho = getCaminhoCapa(pasta);
  if (fs.existsSync(caminho)) {
    console.log(`${LOG} 📥 Capa local encontrada: ${caminho}`);
    return `file://${caminho}`;
  }
  console.warn(`${LOG} ⚠️ Nenhuma capa local disponível em: ${caminho}`);
  return null;
}

// 🔌 IPC para o renderer
function registrarRevistaHandler() {
  ipcMain.handle("revista:obterCaminhoCapa", () => obterCaminhoCapaLocalFileURL());
  ipcMain.handle("revista:debugPing", () => {
    const pasta = getPastaRevista();
    const capa = getCaminhoCapa(pasta);
    const ctrl = getCaminhoControle(pasta);
    return {
      ok: true,
      pasta,
      capaExiste: fs.existsSync(capa),
      controleExiste: fs.existsSync(ctrl),
      capaPath: capa,
      controlePath: ctrl,
    };
  });
}

module.exports = {
  registrarRevistaHandler,
  verificarAtualizacaoCapaEmSegundoPlano,
};
