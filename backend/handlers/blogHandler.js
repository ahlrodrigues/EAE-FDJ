// ============================================================================
// Caminho: ./backend/handlers/blogHandler.js
// Responsável por: Obter a última publicação do feed RSS/Atom e expor IPCs.
// Canais IPC: "blog:buscarUltimaPublicacao", "blog:debugPing"
// ============================================================================
const { ipcMain } = require("electron");
const http = require("http");
const https = require("https");
const zlib = require("zlib");
const { URL } = require("url");

const LOG = "📰[blogHandler]";
const DEFAULT_FEED = process.env.BLOG_FEED_URL || "https://alianca.org.br/site/blog/feed/";

let _registrado = false;

// Canais padronizados (também exportados ao final)
const CHANNELS = Object.freeze({
  FETCH_LAST: "blog:buscarUltimaPublicacao",
  PING: "blog:debugPing",
});

/**
 * GET com redirecionamentos, decodificação (br/gzip/deflate), limite de bytes e timeout.
 */
function fetchWithRedirects(urlStr, maxRedirects = 3, timeoutMs = 10000, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch { return reject(new Error(`URL inválida: ${urlStr}`)); }

    const client = u.protocol === "http:" ? http : https;
    const req = client.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || (u.protocol === "http:" ? 80 : 443),
      headers: {
        "User-Agent": "EAE/1.0 (+electron; blogHandler)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
        "Accept-Encoding": "br, gzip, deflate",
        "Connection": "close",
      },
    }, (res) => {
      const code = res.statusCode || 0;

      if (code >= 300 && code < 400 && res.headers.location) {
        if (maxRedirects <= 0) { res.resume(); return reject(new Error("Muitos redirecionamentos.")); }
        const nextUrl = new URL(res.headers.location, u).toString();
        res.resume();
        return fetchWithRedirects(nextUrl, maxRedirects - 1, timeoutMs, maxBytes).then(resolve, reject);
      }

      if (code < 200 || code >= 300) { res.resume(); return reject(new Error(`HTTP ${code}`)); }

      let stream = res;
      const enc = (res.headers["content-encoding"] || "").toLowerCase();
      try {
        if (enc.includes("br")) stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc.includes("gzip")) stream = res.pipe(zlib.createGunzip());
        else if (enc.includes("deflate")) stream = res.pipe(zlib.createInflate());
      } catch { stream = res; }

      let bytes = 0; const chunks = [];
      stream.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) { stream.destroy(new Error("Resposta muito grande.")); return; }
        chunks.push(chunk);
      });
      stream.on("end", () => {
        try { resolve(Buffer.concat(chunks).toString("utf8")); }
        catch (e) { reject(e); }
      });
      stream.on("error", reject);
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error("Timeout obtendo feed.")));
    req.on("error", reject);
  });
}

// --- Helpers de parse -------------------------------------------------------
function stripCdata(s) { return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"); }
function decodeEntities(s) {
  return s
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCharCode(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(parseInt(d,10)));
}
function textBetween(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}
function attrIn(xml, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]+)"[^>]*\\/?>`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}
function firstItemBlock(xml) {
  return (xml.match(/<item\b[\s\S]*?<\/item>/i) || [])[0]
      || (xml.match(/<entry\b[\s\S]*?<\/entry>/i) || [])[0]
      || "";
}
function toIsoDate(s) { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); }
function stripHtml(s) { return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }

/** Parse do primeiro item do feed (RSS/Atom). */
function parseFeedFirst(xml) {
  const block = firstItemBlock(xml);
  if (!block) return null;

  const rawTitle   = textBetween(block, "title") || textBetween(block, "dc:title");
  const contentEnc = textBetween(block, "content:encoded");
  const summary    = textBetween(block, "summary");
  const descr      = textBetween(block, "description") || summary || contentEnc;

  let link = textBetween(block, "link");
  if (!link) link = attrIn(block, "link", "href");

  const pub = textBetween(block, "pubDate") || textBetween(block, "updated") || textBetween(block, "dc:date");

  const titulo = decodeEntities(stripCdata(rawTitle || "Sem título"));
  const url    = decodeEntities(stripCdata(link || ""));
  const html   = decodeEntities(stripCdata(descr || ""));
  const resumo = stripHtml(html).slice(0, 500);
  const dataISO = toIsoDate(pub);

  return { titulo, resumo, url, dataISO };
}

/**
 * Registra os handlers do módulo de Blog.
 * - blog:debugPing → retorna { ok, when, feed }
 * - blog:buscarUltimaPublicacao → busca feed e retorna 1ª publicação
 */
function registrarBlogHandler(ipc = ipcMain) {
  if (_registrado) { console.warn(`${LOG} Já registrado — ignorando chamada duplicada.`); return; }
  _registrado = true;

  const feed = DEFAULT_FEED;
  if (!feed || typeof feed !== "string" || !feed.trim()) {
    console.warn(`${LOG} BLOG_FEED_URL não definido. Usando padrão: ${DEFAULT_FEED}`);
  }

  console.log(`${LOG} Registrando IPCs: "${CHANNELS.FETCH_LAST}", "${CHANNELS.PING}" (fonte: ${feed})`);

  // 🔎 Ping de diagnóstico
  ipc.handle(CHANNELS.PING, async () => {
    const payload = { ok: true, when: new Date().toISOString(), feed };
    console.log(`${LOG} PING ->`, payload);
    return payload;
  });

  // 📰 Buscar a última publicação do feed
  ipc.handle(CHANNELS.FETCH_LAST, async () => {
    try {
      const body = await fetchWithRedirects(feed);
      const pub = parseFeedFirst(body);
      if (!pub) {
        const resp = { ok: false, erro: "Nenhuma publicação encontrada no feed.", origem: "rss", fonte: feed };
        console.warn(`${LOG} WARN ->`, resp);
        return resp;
      }
      const resp = { ok: true, publicacao: pub, origem: "rss", fonte: feed };
      console.log(`${LOG} OK ->`, `"${pub.titulo}"`, pub.dataISO || "(sem data)");
      return resp;
    } catch (e) {
      const msg = e?.message || String(e);
      const resp = { ok: false, erro: msg, origem: "rss", fonte: feed };
      console.error(`${LOG} ERRO ->`, msg);
      return resp;
    }
  });
}

module.exports = registrarBlogHandler;
module.exports.CHANNELS = CHANNELS;
