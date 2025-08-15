// === backend/lib/googleOAuth.js ===
const http = require("http");
const url = require("url");
const { google } = require("googleapis");
const open = require("open");
const { SCOPES } = require("./googleDriveClient");
const { carregarUsuarioJsonSeguro, salvarUsuarioJsonSeguro, criptografarCampo } = require("./usuarioStore");

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectPort = String(process.env.GOOGLE_REDIRECT_PORT || "53427");
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/SECRET não configurados.");

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `http://127.0.0.1:${redirectPort}/oauth2callback`
  );
}

/**
 * Executa fluxo OAuth Installed App usando loopback (localhost).
 * 1) Abre navegador no consent
 * 2) Escuta callback local
 * 3) Troca code por tokens
 * 4) Persiste tokens (criptografados) em usuario.json (campo backup.oauthTokenEnc)
 */
async function runInstalledAppOAuth() {
  const oauth2Client = getOAuth2Client();
  const redirectPort = Number(process.env.GOOGLE_REDIRECT_PORT || "53427");

  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent" // força refresh_token na 1ª vez
  });

  // Servidor de callback
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) return;
      const qs = new url.URL(req.url, `http://127.0.0.1:${redirectPort}`).searchParams;
      const code = qs.get("code");
      const error = qs.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Erro de autorização: " + error);
        server.close();
        return;
      }

      if (!code) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Recurso não encontrado.");
        return;
      }

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Persiste criptografado no usuario.json
      const all = await carregarUsuarioJsonSeguro();
      all.backup = all.backup || {};
      const tokenJson = JSON.stringify(tokens);
      all.backup.oauthTokenEnc = criptografarCampo(tokenJson);
      await salvarUsuarioJsonSeguro(all);

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Autorização concluída!</h1><p>Você já pode fechar esta janela.</p>");
      server.close();
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Falha no OAuth: " + (e?.message || e));
      server.close();
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(redirectPort, "127.0.0.1", () => {
      open(authorizeUrl).catch(() => {}); // abrir navegador padrão
    });
    server.on("close", async () => {
      // Verifica se salvamos token
      try {
        const all = await carregarUsuarioJsonSeguro();
        if (all?.backup?.oauthTokenEnc) resolve(true);
        else reject(new Error("Token não foi salvo."));
      } catch (e) {
        reject(e);
      }
    });
    server.on("error", (err) => reject(err));
  });
}

module.exports = { runInstalledAppOAuth };
