// utils/dataUtils.js

export function extrairDataDoNome(nomeArquivo) {
  // Espera: yyyy-mm-dd-ss-mm-hh
  const match = nomeArquivo.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [ano, mes, dia, seg, min, hora] = match.slice(1);
  const data = new Date(`${ano}-${mes}-${dia}T${hora}:${min}:${seg}`);

  return isNaN(data.getTime()) ? null : data;
}

export function formatarData(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "-";

  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();
  const hora = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${ano} - ${hora}:${min}`;
}

export function ordenarPorDataDesc(linhas) {
  return linhas.sort((a, b) => b.data - a.data);
}

export function inicializarDataTable(tabelaSelector, colunaDataIndex = 2) {
  const tabela = $(tabelaSelector);
  if ($.fn.dataTable.isDataTable(tabela)) {
    tabela.DataTable().clear().destroy();
  }

  tabela.DataTable({
    order: [[colunaDataIndex, "desc"]],
    language: {
      url: "https://cdn.datatables.net/plug-ins/1.13.4/i18n/pt-BR.json"
    },
    columnDefs: [
      { targets: 0, orderable: false } // checkbox não ordenável
    ]
  });
}
