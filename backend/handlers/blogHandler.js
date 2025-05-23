
function registrarBlogHandler(ipcMain) {
// ipcMain removido - será passado como argumento
// const { ipcMain } = require('electron');
const https = require('https');

function registrarBlogHandler() {
  console.log("🧠 [MAIN] blogHandler registrado");

  ipcMain.handle('blog:buscarUltimaPublicacao', async () => {
    console.log("📥 [MAIN] Recebido pedido do preload para buscar blog");

    const url = 'https://alianca.org.br/site/blog/feed/';

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        console.log("🌐 [MAIN] Requisição feita com status:", res.statusCode);

        let data = '';

        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log("📦 [MAIN] Conteúdo recebido do feed");

          try {
            const match = data.match(/<item>([\s\S]*?)<\/item>/i);
if (!match) {
  console.warn("⚠️ [MAIN] Nenhum item encontrado no RSS");
  return resolve({ titulo: undefined, descricao: undefined, link: undefined });
}

const item = match[1]; // ✅ Agora item só será usado se existir
console.log("📦 [MAIN] XML do item:", item);

            const tituloMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
const descricaoMatch = item.match(/<description>([\s\S]*?)<\/description>/i);

const titulo = tituloMatch ? tituloMatch[1].trim() : 'Sem título';
const link = linkMatch ? linkMatch[1].trim() : null;
const descricaoBruta = descricaoMatch ? descricaoMatch[1].trim() : 'Sem descrição';

// Remove tags HTML da descrição, se preferir apenas texto puro:
const descricao = descricaoBruta.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

resolve({ titulo, link, descricao });





            console.log("✅ [MAIN] Publicação encontrada:", titulo);
            resolve({ titulo, link, descricao });
          } catch (e) {
            console.error("❌ [MAIN] Erro ao processar o XML", e);
            reject(e);
          }
        });
      }).on('error', err => {
        console.error("❌ [MAIN] Erro na requisição HTTPS", err);
        reject(err);
      });
    });
  });
}

module.exports = registrarBlogHandler;

}

module.exports = registrarBlogHandler;
