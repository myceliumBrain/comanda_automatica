/* historico.js — lógica específica do histórico
   Depende de: utils.js                           */

// ── RENDERIZAÇÃO ──

function renderResumo(pedidos) {
  const total = pedidos.length;
  const faturamento = pedidos.reduce((acc, p) => {
    return acc + (parseFloat(p.valor.replace(',', '.')) || 0);
  }, 0);

  const porForma = pedidos.reduce((acc, p) => {
    acc[p.forma] = (acc[p.forma] || 0) + 1;
    return acc;
  }, {});
  const formaMaisUsada = Object.entries(porForma).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('resumo-bar').innerHTML = `
    <div class="resumo-card">
      <div class="resumo-valor">${total}</div>
      <div class="resumo-label">Pedidos no dia</div>
    </div>
    <div class="resumo-card green">
      <div class="resumo-valor">R$ ${faturamento.toFixed(2).replace('.', ',')}</div>
      <div class="resumo-label">Faturamento total</div>
    </div>
    <div class="resumo-card">
      <div class="resumo-valor">${formaMaisUsada ? formaMaisUsada[0] : '—'}</div>
      <div class="resumo-label">Pagamento mais usado</div>
    </div>
  `;
}

function renderPedidos(pedidos) {
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

  // Mais recente primeiro
  [...pedidos].reverse().forEach(p => {
    const card = document.createElement('div');
    card.className = 'pedido-card';

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

    card.innerHTML = `
      <div class="pedido-header" onclick="toggleCard(this)">
        <span class="pedido-num">#${p.num}</span>
        <span class="pedido-nome">${p.nome}</span>
        <span class="pedido-hora">${p.hora}</span>
        <span class="pedido-valor">R$ ${p.valor}</span>
        <span class="pedido-forma">${p.forma}</span>
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

// ── FILTRO POR DATA ──

function carregarData(data) {
  const pedidos = JSON.parse(localStorage.getItem(chaveData(data)) || '[]');
  renderPedidos(pedidos);
}

// ── LIMPAR DIA ──

function limparHistorico() {
  const data = document.getElementById('filtro-data').value;
  if (!confirm(`Apagar todos os pedidos de ${data.split('-').reverse().join('/')}?`)) return;
  localStorage.removeItem(chaveData(data));
  carregarData(data);
  showToast('Histórico apagado!');
}

// ── INIT ──

const inputData = document.getElementById('filtro-data');
inputData.value = dataHoje();
inputData.addEventListener('change', () => carregarData(inputData.value));
carregarData(dataHoje());