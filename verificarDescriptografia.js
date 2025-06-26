const { descriptografarComSenha } = require("./backend/lib/criptografia");

const chaveUsuario = "senha-do-usuario"; // substitua pela senha usada na criação
const conteudo = "smn3Cn2527D9YA3UdXDvfA==:u5xj1c8YNpdbsMe0pKSIvJ37RlHzbSnsrm9hoA97uqdL0cRcVE1fZvaxZGr1Ro55MudFxRJZW28cuYlLl2+RwvB8PoPRL1l2rMgptrvsisBVkuUc/3VwBaKlIy3sA51GAMtLp1Qhcyn4nDngW4JExFOnB9/tc+i+/cC3EjjzGQcqsSk3dii+mRZ/fZM13nfn";

try {
  const resultado = descriptografarComSenha(conteudo, chaveUsuario);
  console.log("🔓 Descriptografado com sucesso:", resultado);
} catch (erro) {
  console.error("❌ Falha na descriptografia:", erro.message);
}