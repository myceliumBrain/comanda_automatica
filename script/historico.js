/* historico.js — lógica do histórico
   Depende de: utils.js (window.api via preload) */

let pedidosAtivos = []; // cache do dia atual

// ── RENDERIZAÇÃO ──

function renderResumo(pedidos) {
  const cancelados    = pedidos.filter(p => p.cancelado);
  const validos       = pedidos.filter(p => !p.cancelado);
  const faturamento   = validos.reduce((acc, p) => acc + (parseFloat(p.valor.replace(',', '.')) || 0), 0);

  const porForma      = validos.reduce((acc, p) => { acc[p.forma] = (acc[p.forma] || 0) + 1; return acc; }, {});
  const formaMaisUsada = Object.entries(porForma).sort((a, b) => b[1] - a[1])[0];

  const labelTotal = cancelados.length
    ? `${pedidos.length} <span class="resumo-cancelados">(${cancelados.length} cancelado${cancelados.length > 1 ? 's' : ''})</span>`
    : `${pedidos.length}`;

  document.getElementById('resumo-bar').innerHTML = `
    <div class="resumo-card">
      <div class="resumo-valor">${labelTotal}</div>
      <div class="resumo-label">Pedidos no dia</div>
    </div>
    <div class="resumo-card green">
      <div class="resumo-valor">R$ ${faturamento.toFixed(2).replace('.', ',')}</div>
      <div class="resumo-label">Faturamento (sem cancelados)</div>
    </div>
    <div class="resumo-card">
      <div class="resumo-valor">${formaMaisUsada ? formaMaisUsada[0] : '—'}</div>
      <div class="resumo-label">Pagamento mais usado</div>
    </div>
  `;
}

function renderPedidos(pedidos) {
  pedidosAtivos = pedidos;
  const lista = document.getElementById('lista-pedidos');
  const empty = document.getElementById('empty-state');
  lista.innerHTML = '';

  if (!pedidos.length) {
    empty.style.display = 'block';
    document.getElementById('resumo-bar').innerHTML = '';
    return;
  }

  empty.style.display = 'none';
  renderResumo(pedidos);

  [...pedidos].reverse().forEach(p => {
    const card = document.createElement('div');
    card.className = 'pedido-card' + (p.cancelado ? ' cancelado' : '');
    card.id = `pedido-${p.id}`;

    const pratosHtml = p.pratos.length
      ? p.pratos.map(pr => `
          <div class="pedido-item">• ${pr.nome || '<em>não informado</em>'}
            ${pr.obs ? `<div class="pedido-obs">${pr.obs}</div>` : ''}
          </div>`).join('')
      : '<div class="pedido-item" style="color:var(--muted)">—</div>';

    const bebidasHtml = p.bebidas.length
      ? p.bebidas.map(b => `<div class="pedido-item">• ${b.nome || '<em>não informado</em>'}</div>`).join('')
      : '<div class="pedido-item" style="color:var(--muted)">—</div>';

    const trocoHtml = p.forma === 'Dinheiro' && p.troco
      ? `<div class="pedido-troco">Troco para: R$ ${p.troco}</div>` : '';

    const cancelLabel  = p.cancelado ? 'Descancelar' : 'Cancelar';
    const cancelClass  = p.cancelado ? 'btn-cancelar descancelado' : 'btn-cancelar';
    const tagCancelado = p.cancelado ? '<span class="tag-cancelado">CANCELADO</span>' : '';

    card.innerHTML = `
      <div class="pedido-header" onclick="toggleCard(this)">
        <span class="pedido-num">#${p.num}</span>
        <span class="pedido-nome">${p.nome}</span>
        ${tagCancelado}
        <span class="pedido-hora">${p.hora}</span>
        <span class="pedido-valor">R$ ${p.valor}</span>
        <span class="pedido-forma">${p.forma}</span>
        <button class="${cancelClass}" onclick="toggleCancelado(event, ${p.id})">${cancelLabel}</button>
        <span class="chevron">▼</span>
      </div>
      <div class="pedido-body">
        <div class="pedido-section">
          <div class="pedido-section-title">🍽 Pratos</div>
          ${pratosHtml}
        </div>
        <div class="pedido-section">
          <div class="pedido-section-title">🥤 Bebidas</div>
          ${bebidasHtml}
        </div>
        <div class="pedido-section" style="min-width:120px;max-width:160px">
          <div class="pedido-section-title">💰 Pagamento</div>
          <div class="pedido-item">${p.forma}</div>
          ${trocoHtml}
        </div>
      </div>
    `;
    lista.appendChild(card);
  });
}

function toggleCard(header) {
  header.parentElement.classList.toggle('open');
}

// ── CANCELAR / DESCANCELAR ──

async function toggleCancelado(event, id) {
  event.stopPropagation(); // não abre/fecha o card
  const data = document.getElementById('filtro-data').value;
  await window.api.toggleCanceladoPedido(data, id);
  carregarData(data);
}

// ── CARREGAR DATA ──

async function carregarData(data) {
  const pedidos = await lerHistorico(data); // utils.js
  renderPedidos(pedidos);
}

// ── LIMPAR DIA ──

async function limparHistorico() {
  const data = document.getElementById('filtro-data').value;
  if (!confirm(`Apagar todos os pedidos de ${data.split('-').reverse().join('/')}?`)) return;
  await window.api.limparHistorico(data);
  carregarData(data);
  showToast('Histórico apagado!');
}

// ── IMPRESSÃO DO DIA ──

function imprimirDia() {
  const data    = document.getElementById('filtro-data').value;
  const [ano, mes, dia] = data.split('-');
  const dataFmt = `${dia}/${mes}/${ano}`;

  const validos     = pedidosAtivos.filter(p => !p.cancelado);
  const cancelados  = pedidosAtivos.filter(p =>  p.cancelado);
  const faturamento = validos.reduce((acc, p) => acc + (parseFloat(p.valor.replace(',', '.')) || 0), 0);

  const linhas = [...pedidosAtivos].sort((a, b) => a.id - b.id).map(p => {
    const pratos  = p.pratos.map(pr => pr.nome + (pr.obs ? ` (${pr.obs})` : '')).join('; ') || '—';
    const bebidas = p.bebidas.map(b => b.nome).join('; ') || '—';
    const status  = p.cancelado ? 'CANCELADO' : '';
    return `
      <tr class="${p.cancelado ? 'linha-cancelada' : ''}">
        <td>#${p.num}</td>
        <td>${p.nome}</td>
        <td>${p.hora}</td>
        <td>${pratos}</td>
        <td>${bebidas}</td>
        <td>R$ ${p.valor}</td>
        <td>${p.forma}${p.troco ? ` / trc ${p.troco}` : ''}</td>
        <td class="col-status">${status}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório — Bar do Júlio — ${dataFmt}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; padding: 20px; }
  h1  { font-size: 16px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px; }
  .sub { font-size: 10px; letter-spacing: 1px; color: #555; margin-bottom: 14px; }
  .resumo { display: flex; gap: 24px; margin-bottom: 16px; border: 1px solid #999; padding: 10px 14px; }
  .resumo-item { display: flex; flex-direction: column; }
  .resumo-item span:first-child { font-size: 15px; font-weight: bold; }
  .resumo-item span:last-child  { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #000; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; padding: 5px 6px; text-align: left; }
  td { padding: 5px 6px; border-bottom: 1px solid #ddd; vertical-align: top; font-size: 10px; }
  tr:nth-child(even) td { background: #f5f5f5; }
  .linha-cancelada td { color: #999; text-decoration: line-through; background: #fafafa !important; }
  .col-status { color: #c00; font-weight: bold; text-decoration: none !important; }
  .linha-cancelada .col-status { text-decoration: none; color: #c00; }
  .rodape { margin-top: 18px; font-size: 9px; color: #888; border-top: 1px solid #ccc; padding-top: 8px; }
</style>
</head>
<body>
  <h1>Bar do Júlio</h1>
  <div class="sub">Relatório do dia — ${dataFmt}</div>
  <div class="resumo">
    <div class="resumo-item"><span>${pedidosAtivos.length}</span><span>Total de pedidos</span></div>
    <div class="resumo-item"><span>${validos.length}</span><span>Confirmados</span></div>
    ${cancelados.length ? `<div class="resumo-item"><span>${cancelados.length}</span><span>Cancelados</span></div>` : ''}
    <div class="resumo-item"><span>R$ ${faturamento.toFixed(2).replace('.', ',')}</span><span>Faturamento</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Nº</th><th>Cliente</th><th>Hora</th><th>Pratos</th><th>Bebidas</th><th>Valor</th><th>Pagamento</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
  <div class="rodape">Emitido em: ${new Date().toLocaleString('pt-BR')} · Bar do Júlio — Sistema de Comanda Digital</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ── INIT ──

const inputData = document.getElementById('filtro-data');
inputData.value = dataHoje(); // utils.js
inputData.addEventListener('change', () => carregarData(inputData.value));
carregarData(dataHoje());
