/* agendamentos.js — lógica da página de agendamentos
   Depende de: utils.js                               */

let filtroAtivo = 'futuros';

// ── INIT ──

document.addEventListener('DOMContentLoaded', () => {
  // Define data padrão como hoje
  document.getElementById('ag-data').value = dataHoje();
  renderLista();
});

// ── SALVAR NOVO AGENDAMENTO ──

function salvarNovoAgendamento() {
  const cliente    = document.getElementById('ag-cliente').value.trim();
  const data       = document.getElementById('ag-data').value;
  const obs        = document.getElementById('ag-obs').value.trim();
  const horaPedido = document.getElementById('ag-hora-pedido').value;  // 'HH:MM' ou ''
  const horaEnvio  = document.getElementById('ag-hora-envio').value;   // 'HH:MM' ou ''

  if (!cliente)  { showToast('Informe o nome do cliente!'); return; }
  if (!data)     { showToast('Selecione a data!'); return; }

  criarAgendamento({ cliente, data, obs, horaPedido, horaEnvio }); // utils.js

  document.getElementById('ag-cliente').value    = '';
  document.getElementById('ag-obs').value        = '';
  document.getElementById('ag-data').value       = dataHoje();
  document.getElementById('ag-hora-pedido').value = '';
  document.getElementById('ag-hora-envio').value  = '';

  showToast('Agendamento salvo!');
  renderLista();
}

// ── FILTRO ──

function setFiltro(btn, filtro) {
  document.querySelectorAll('.ag-filtro-btn').forEach(b => b.classList.remove('ativo'));
  btn.classList.add('ativo');
  filtroAtivo = filtro;
  renderLista();
}

// ── RENDER LISTA ──

function renderLista() {
  const todos    = carregarAgendamentos(); // utils.js
  const hoje     = dataHoje();

  let lista;
  if (filtroAtivo === 'futuros') {
    lista = todos.filter(a => a.data >= hoje && !a.concluido);
  } else if (filtroAtivo === 'concluidos') {
    lista = todos.filter(a => a.concluido);
  } else {
    lista = [...todos];
  }

  // Ordena por data
  lista.sort((a, b) => a.data.localeCompare(b.data));

  const container = document.getElementById('ag-lista');

  if (!lista.length) {
    container.innerHTML = `
      <div class="ag-vazio">
        ${filtroAtivo === 'futuros'    ? 'Nenhum agendamento próximo.' : ''}
        ${filtroAtivo === 'concluidos' ? 'Nenhum agendamento concluído.' : ''}
        ${filtroAtivo === 'todos'      ? 'Nenhum agendamento cadastrado.' : ''}
      </div>`;
    return;
  }

  // Agrupa por data
  const porData = {};
  lista.forEach(a => {
    if (!porData[a.data]) porData[a.data] = [];
    porData[a.data].push(a);
  });

  container.innerHTML = Object.entries(porData).map(([data, itens]) => {
    const isHoje    = data === hoje;
    const isPast    = data < hoje;
    const dataLabel = formatarDataBR(data) + (isHoje ? ' — HOJE' : '');

    const itensHtml = itens.map(a => {
      const horarios = [];
      if (a.horaPedido) horarios.push(`🕐 pedido: ${a.horaPedido}`);
      if (a.horaEnvio)  horarios.push(`🚀 envio: ${a.horaEnvio}`);
      const horariosHtml = horarios.length
        ? `<span class="ag-item-horarios">${horarios.join('  ·  ')}</span>`
        : '';

      return `
      <div class="ag-item ${a.concluido ? 'concluido' : ''} ${isPast && !a.concluido ? 'atrasado' : ''}">
        <div class="ag-item-info">
          <span class="ag-item-cliente">${a.cliente}</span>
          ${horariosHtml}
          ${a.obs ? `<span class="ag-item-obs">${a.obs}</span>` : ''}
          ${isPast && !a.concluido ? `<span class="ag-item-tag atrasado-tag">⚠ atrasado</span>` : ''}
          ${a.concluido            ? `<span class="ag-item-tag concluido-tag">✓ concluído</span>` : ''}
        </div>
        <div class="ag-item-acoes">
          ${!a.concluido
            ? `<a class="ag-btn-comanda" href="./index.html?cliente=${encodeURIComponent(a.cliente)}&agendId=${a.id}">
                 abrir comanda →
               </a>`
            : ''
          }
          <button class="ag-btn-excluir" onclick="confirmarExcluir(${a.id}, '${escaparAttr(a.cliente)}')">excluir</button>
        </div>
      </div>
    `;
    }).join('');

    return `
      <div class="ag-grupo">
        <div class="ag-grupo-data ${isHoje ? 'hoje' : ''}">${dataLabel}</div>
        ${itensHtml}
      </div>
    `;
  }).join('');
}

function escaparAttr(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── EXCLUIR ──

function confirmarExcluir(id, cliente) {
  if (!confirm(`Excluir agendamento de "${cliente}"?`)) return;
  deletarAgendamento(id); // utils.js
  showToast('Agendamento excluído.');
  renderLista();
}