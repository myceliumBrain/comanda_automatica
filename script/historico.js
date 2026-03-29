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
        <button class="btn-reimprimir" onclick="reimprimir(event, ${p.id})">🖨 Reimprimir</button>
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

// ── REIMPRIMIR ──

async function reimprimir(event, id) {
  event.stopPropagation();
  const pedido = pedidosAtivos.find(p => p.id === id);
  if (!pedido) return;
  try {
    await window.api.imprimir(pedido);
    showToast('Comanda reimpressa!');
  } catch (e) {
    showToast('Erro ao reimprimir: ' + e.message);
  }
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

// ── IMPRESSÃO DA SEMANA ──

async function imprimirSemana() {
  const dataStr = document.getElementById('filtro-data').value;
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const base = new Date(ano, mes - 1, dia);

  // Segunda-feira da semana
  const dow = base.getDay(); // 0=dom
  const diffSeg = dow === 0 ? -6 : 1 - dow;
  const seg = new Date(base);
  seg.setDate(base.getDate() + diffSeg);

  const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Monta lista de 7 datas (seg → dom)
  const datas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg);
    d.setDate(seg.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const fmt = d => d.split('-').reverse().join('/');

  // Carrega todos os dias em paralelo
  const dadosDias = await Promise.all(datas.map(d => lerHistorico(d)));

  // Totais gerais
  let totalPedidos = 0, totalValidos = 0, totalCancelados = 0, totalFaturamento = 0;
  dadosDias.forEach(pedidos => {
    totalPedidos    += pedidos.length;
    totalValidos    += pedidos.filter(p => !p.cancelado).length;
    totalCancelados += pedidos.filter(p =>  p.cancelado).length;
    totalFaturamento += pedidos.filter(p => !p.cancelado)
      .reduce((acc, p) => acc + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
  });

  // Gera seção por dia
  const secoesDias = datas.map((data, idx) => {
    const pedidos   = dadosDias[idx];
    const validos   = pedidos.filter(p => !p.cancelado);
    const fat       = validos.reduce((acc, p) => acc + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
    const baseDate  = new Date(data + 'T00:00:00');
    const nomeDia   = NOMES_DIA[baseDate.getDay()];

    if (!pedidos.length) {
      return `
        <div class="dia-secao">
          <div class="dia-titulo">${nomeDia} — ${fmt(data)}</div>
          <p class="dia-vazio">Sem pedidos registrados</p>
        </div>`;
    }

    const linhas = [...pedidos].sort((a, b) => a.id - b.id).map(p => {
      const pratos  = p.pratos.map(pr => pr.nome + (pr.obs ? ` (${pr.obs})` : '')).join('; ') || '—';
      const bebidas = p.bebidas.map(b => b.nome).join('; ') || '—';
      return `
        <tr class="${p.cancelado ? 'linha-cancelada' : ''}">
          <td>#${p.num}</td>
          <td>${p.nome}</td>
          <td>${p.hora}</td>
          <td>${pratos}</td>
          <td>${bebidas}</td>
          <td>R$ ${p.valor}</td>
          <td>${p.forma}${p.troco ? ` / trc ${p.troco}` : ''}</td>
          <td class="col-status">${p.cancelado ? 'CANC.' : ''}</td>
        </tr>`;
    }).join('');

    return `
      <div class="dia-secao">
        <div class="dia-titulo">${nomeDia} — ${fmt(data)}</div>
        <div class="dia-resumo">
          <span>${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}</span>
          <span>${validos.length} confirmado${validos.length !== 1 ? 's' : ''}</span>
          ${pedidos.filter(p => p.cancelado).length ? `<span class="canc-label">${pedidos.filter(p => p.cancelado).length} cancelado${pedidos.filter(p => p.cancelado).length !== 1 ? 's' : ''}</span>` : ''}
          <span class="fat-label">R$ ${fat.toFixed(2).replace('.', ',')}</span>
        </div>
        <table>
          <thead>
            <tr><th>Nº</th><th>Cliente</th><th>Hora</th><th>Pratos</th><th>Bebidas</th><th>Valor</th><th>Pagamento</th><th>St.</th></tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }).join('');

  const dataIni = fmt(datas[0]);
  const dataFim = fmt(datas[6]);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Semanal — Bar do Júlio — ${dataIni} a ${dataFim}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; padding: 20px; }
  h1  { font-size: 16px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px; }
  .sub { font-size: 10px; letter-spacing: 1px; color: #555; margin-bottom: 16px; }
  .resumo-geral { display: flex; gap: 20px; margin-bottom: 20px; border: 1px solid #999; padding: 10px 14px; flex-wrap: wrap; }
  .resumo-item { display: flex; flex-direction: column; }
  .resumo-item span:first-child { font-size: 15px; font-weight: bold; }
  .resumo-item span:last-child  { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
  .dia-secao { margin-bottom: 22px; page-break-inside: avoid; }
  .dia-titulo { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
  .dia-resumo { display: flex; gap: 14px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 6px; }
  .fat-label  { color: #006600; font-weight: bold; }
  .canc-label { color: #cc0000; }
  .dia-vazio  { font-size: 10px; color: #aaa; font-style: italic; padding: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #000; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; padding: 4px 5px; text-align: left; }
  td { padding: 4px 5px; border-bottom: 1px solid #ddd; vertical-align: top; font-size: 10px; }
  tr:nth-child(even) td { background: #f5f5f5; }
  .linha-cancelada td { color: #999; text-decoration: line-through; background: #fafafa !important; }
  .col-status { color: #c00; font-weight: bold; text-decoration: none !important; white-space: nowrap; }
  .rodape { margin-top: 18px; font-size: 9px; color: #888; border-top: 1px solid #ccc; padding-top: 8px; }
</style>
</head>
<body>
  <h1>Bar do Júlio</h1>
  <div class="sub">Relatório semanal — ${dataIni} a ${dataFim}</div>
  <div class="resumo-geral">
    <div class="resumo-item"><span>${totalPedidos}</span><span>Total de pedidos</span></div>
    <div class="resumo-item"><span>${totalValidos}</span><span>Confirmados</span></div>
    ${totalCancelados ? `<div class="resumo-item"><span>${totalCancelados}</span><span>Cancelados</span></div>` : ''}
    <div class="resumo-item"><span>R$ ${totalFaturamento.toFixed(2).replace('.', ',')}</span><span>Faturamento total</span></div>
  </div>
  ${secoesDias}
  <div class="rodape">Emitido em: ${new Date().toLocaleString('pt-BR')} · Bar do Júlio — Sistema de Comanda Digital</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ── IMPRESSÃO DO MÊS ──

async function imprimirMes() {
  const dataStr = document.getElementById('filtro-data').value;
  const [ano, mes] = dataStr.split('-').map(Number);

  const diasNoMes = new Date(ano, mes, 0).getDate();
  const datas = Array.from({ length: diasNoMes }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    const m = String(mes).padStart(2, '0');
    return `${ano}-${m}-${d}`;
  });

  const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const fmt = d => d.split('-').reverse().join('/');

  const dadosDias = await Promise.all(datas.map(d => lerHistorico(d)));

  let totalPedidos = 0, totalValidos = 0, totalCancelados = 0, totalFaturamento = 0;
  dadosDias.forEach(pedidos => {
    totalPedidos    += pedidos.length;
    totalValidos    += pedidos.filter(p => !p.cancelado).length;
    totalCancelados += pedidos.filter(p =>  p.cancelado).length;
    totalFaturamento += pedidos.filter(p => !p.cancelado)
      .reduce((acc, p) => acc + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
  });

  const secoesDias = datas.map((data, idx) => {
    const pedidos  = dadosDias[idx];
    if (!pedidos.length) return '';

    const validos  = pedidos.filter(p => !p.cancelado);
    const fat      = validos.reduce((acc, p) => acc + (parseFloat(p.valor.replace(',', '.')) || 0), 0);
    const baseDate = new Date(data + 'T00:00:00');
    const nomeDia  = NOMES_DIA[baseDate.getDay()];

    const linhas = [...pedidos].sort((a, b) => a.id - b.id).map(p => {
      const pratos  = p.pratos.map(pr => pr.nome + (pr.obs ? ` (${pr.obs})` : '')).join('; ') || '—';
      const bebidas = p.bebidas.map(b => b.nome).join('; ') || '—';
      return `
        <tr class="${p.cancelado ? 'linha-cancelada' : ''}">
          <td>#${p.num}</td><td>${p.nome}</td><td>${p.hora}</td>
          <td>${pratos}</td><td>${bebidas}</td>
          <td>R$ ${p.valor}</td>
          <td>${p.forma}${p.troco ? ` / trc ${p.troco}` : ''}</td>
          <td class="col-status">${p.cancelado ? 'CANC.' : ''}</td>
        </tr>`;
    }).join('');

    return `
      <div class="dia-secao">
        <div class="dia-titulo">${nomeDia} — ${fmt(data)}</div>
        <div class="dia-resumo">
          <span>${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}</span>
          <span>${validos.length} confirmado${validos.length !== 1 ? 's' : ''}</span>
          ${pedidos.filter(p => p.cancelado).length ? `<span class="canc-label">${pedidos.filter(p => p.cancelado).length} cancelado${pedidos.filter(p => p.cancelado).length !== 1 ? 's' : ''}</span>` : ''}
          <span class="fat-label">R$ ${fat.toFixed(2).replace('.', ',')}</span>
        </div>
        <table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Hora</th><th>Pratos</th><th>Bebidas</th><th>Valor</th><th>Pagamento</th><th>St.</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Mensal — Bar do Júlio — ${NOMES_MES[mes - 1]} ${ano}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; padding: 20px; }
  h1  { font-size: 16px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px; }
  .sub { font-size: 10px; letter-spacing: 1px; color: #555; margin-bottom: 16px; }
  .resumo-geral { display: flex; gap: 20px; margin-bottom: 20px; border: 1px solid #999; padding: 10px 14px; flex-wrap: wrap; }
  .resumo-item { display: flex; flex-direction: column; }
  .resumo-item span:first-child { font-size: 15px; font-weight: bold; }
  .resumo-item span:last-child  { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
  .dia-secao { margin-bottom: 22px; page-break-inside: avoid; }
  .dia-titulo { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
  .dia-resumo { display: flex; gap: 14px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 6px; }
  .fat-label  { color: #006600; font-weight: bold; }
  .canc-label { color: #cc0000; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #000; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; padding: 4px 5px; text-align: left; }
  td { padding: 4px 5px; border-bottom: 1px solid #ddd; vertical-align: top; font-size: 10px; }
  tr:nth-child(even) td { background: #f5f5f5; }
  .linha-cancelada td { color: #999; text-decoration: line-through; background: #fafafa !important; }
  .col-status { color: #c00; font-weight: bold; text-decoration: none !important; white-space: nowrap; }
  .rodape { margin-top: 18px; font-size: 9px; color: #888; border-top: 1px solid #ccc; padding-top: 8px; }
</style>
</head>
<body>
  <h1>Bar do Júlio</h1>
  <div class="sub">Relatório mensal — ${NOMES_MES[mes - 1]} de ${ano}</div>
  <div class="resumo-geral">
    <div class="resumo-item"><span>${totalPedidos}</span><span>Total de pedidos</span></div>
    <div class="resumo-item"><span>${totalValidos}</span><span>Confirmados</span></div>
    ${totalCancelados ? `<div class="resumo-item"><span>${totalCancelados}</span><span>Cancelados</span></div>` : ''}
    <div class="resumo-item"><span>R$ ${totalFaturamento.toFixed(2).replace('.', ',')}</span><span>Faturamento total</span></div>
  </div>
  ${secoesDias || '<p style="color:#aaa;font-style:italic">Nenhum pedido registrado neste mês.</p>'}
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
inputData.value = dataHoje();
inputData.addEventListener('change', () => carregarData(inputData.value));
carregarData(dataHoje());
