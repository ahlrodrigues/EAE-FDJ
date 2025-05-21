console.log("📥 loginHandler.js carregado")

function registrarLoginHandler(ipcMain) {
  console.log("✅ registrando handler validar-login");

  const fs = require("fs");
  const path = require("path");
  const bcrypt = require("bcryptjs"); 
  const os = require("os");

  const usuarioPath = path.join(
  os.homedir(),
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);
  console.log("📄 Verificando usuário em:", usuarioPath);


  console.log("📄 Caminho resolvido do usuario.json:", usuarioPath);
  console.log("📄 Arquivo existe?", fs.existsSync(usuarioPath));

  ipcMain.handle("validar-login", async (_, emailDigitado, senhaDigitada) => {
    console.log("🔐 Validando login para:", emailDigitado);

    if (!fs.existsSync(usuarioPath)) {
      return { sucesso: false, erro: "Nenhum usuário cadastrado." };
    }

    let dados;
    try {
      dados = JSON.parse(fs.readFileSync(usuarioPath, "utf-8"));
    } catch (erro) {
      return { sucesso: false, erro: "Erro ao ler os dados do usuário." };
    }

    if (!Array.isArray(dados.usuarios)) {
      return { sucesso: false, erro: "Formato de dados inválido." };
    }

    const usuario = dados.usuarios.find(u => u.email.toLowerCase() === emailDigitado.toLowerCase());

    if (!usuario) {
      return { sucesso: false, erro: "E-mail não encontrado." };
    }

    const senhaOk = await bcrypt.compare(senhaDigitada, usuario.senha);
    if (!senhaOk) {
      return { sucesso: false, erro: "Senha incorreta." };
    }

    console.log("✅ Login autorizado para:", usuario.email);
    return { sucesso: true };
  });
}

module.exports = registrarLoginHandler;
