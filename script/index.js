/* index.js — lógica da comanda principal
   Depende de: utils.js (window.api já disponível via preload) */

let pratoCount  = 0;
let bebidaCount = 0;
let cardapio    = { pratos: [], bebidas: [] };
let frete       = { bairros: [] };

let diaAtivo = diaAtualSistema(); // utils.js

// ── PAINEL DO DIA ──

function setDia(dia) {
  diaAtivo = dia;
  document.querySelectorAll('.dia-btn').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.dia === dia);
  });
  if (document.getElementById('dia-panel').classList.contains('aberto')) {
    renderCardapioDia();
  }
}

// ── PAINÉIS (cardápio, frete, menu) ──

function closeAllPanels() {
  ['dia-panel', 'frete-panel', 'menu-panel'].forEach(id => {
    document.getElementById(id)?.classList.remove('aberto');
  });
  ['.cardapio-tab', '.frete-tab', '.menu-tab'].forEach(sel => {
    document.querySelector(sel)?.classList.remove('escondido');
  });
  document.getElementById('dia-panel-backdrop')?.classList.remove('ativo');
}

function abrirPainel(panelId, ladoDireito, renderFn) {
  const painel = document.getElementById(panelId);
  const jaAberto = painel.classList.contains('aberto');
  closeAllPanels();
  if (!jaAberto) {
    painel.classList.add('aberto');
    if (ladoDireito) {
      document.querySelector('.cardapio-tab')?.classList.add('escondido');
      document.querySelector('.frete-tab')?.classList.add('escondido');
    } else {
      document.querySelector('.menu-tab')?.classList.add('escondido');
    }
    document.getElementById('dia-panel-backdrop').classList.add('ativo');
    if (renderFn) renderFn();
  }
}

function toggleCardapioDia() { abrirPainel('dia-panel',   true,  renderCardapioDia); }
function toggleFretePainel()  { abrirPainel('frete-panel', true,  renderFretePainel); }
function toggleMenuPainel()   { abrirPainel('menu-panel',  false, null); }

function renderFretePainel() {
  const inner = document.getElementById('frete-panel-inner');
  if (!frete.bairros.length) {
    inner.innerHTML = '<div class="frete-panel-vazio">Nenhum bairro cadastrado.</div>';
    return;
  }
  const ordenados = [...frete.bairros].sort((a, b) => a.bairro.localeCompare(b.bairro, 'pt-BR'));
  inner.innerHTML = ordenados.map(b => `
    <div class="frete-panel-row">
      <span class="frete-panel-bairro">${b.bairro}</span>
      <span class="frete-panel-preco">R$ ${b.preco.toFixed(2).replace('.', ',')}</span>
    </div>
  `).join('');
}

function renderCardapioDia() {
  const pratos  = cardapio.pratos.filter(p => !p.disponibilidade || p.disponibilidade.includes(diaAtivo));
  const bebidas = cardapio.bebidas.filter(b => !b.disponibilidade || b.disponibilidade.includes(diaAtivo));

  const itemHtml = item => `
    <div class="cardapio-item">
      <span class="cardapio-item-nome">• ${item.nome}</span>
      ${item.preco > 0 ? `<span class="cardapio-item-preco">R$ ${item.preco.toFixed(2).replace('.', ',')}</span>` : ''}
    </div>`;
  const vazio = msg => `<div class="cardapio-vazio">${msg}</div>`;

  document.getElementById('cardapio-dia-inner').innerHTML = `
    <div class="cardapio-col">
      <div class="cardapio-col-title">🍽 Pratos</div>
      ${pratos.length  ? pratos.map(itemHtml).join('')  : vazio('Nenhum prato disponível')}
    </div>
    <div class="cardapio-col">
      <div class="cardapio-col-title">🥤 Bebidas</div>
      ${bebidas.length ? bebidas.map(itemHtml).join('') : vazio('Nenhuma bebida disponível')}
    </div>
  `;
}

function filtrarDisponivel(lista) {
  return lista.filter(item => !item.disponibilidade || item.disponibilidade.includes(diaAtivo));
}

// ── AUTOCOMPLETE ──

function buildAutocomplete(input, lista) {
  const wrapper  = input.parentElement;
  wrapper.style.position = 'relative';

  const dropdown = document.createElement('ul');
  dropdown.className = 'autocomplete-list';
  wrapper.appendChild(dropdown);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    if (!q) { dropdown.style.display = 'none'; return; }

    const matches = filtrarDisponivel(lista)
      .filter(item => item.nome.toLowerCase().includes(q))
      .slice(0, 6);

    if (!matches.length) { dropdown.style.display = 'none'; return; }

    matches.forEach(item => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.textContent = item.nome + (item.preco > 0 ? ` — R$ ${item.preco.toFixed(2).replace('.', ',')}` : '');
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = item.nome;
        dropdown.style.display = 'none';
        // Preenche o campo de valor do item
        const precoInput = input.closest('.item-card')?.querySelector('.item-preco-input');
        if (precoInput && item.preco > 0) {
          precoInput.value = item.preco.toFixed(2).replace('.', ',');
        }
        recalcularTotal();
      });
      dropdown.appendChild(li);
    });
    dropdown.style.display = 'block';
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { dropdown.style.display = 'none'; }, 150);
  });
}

// ── ITENS ──

function qtyControlHtml() {
  return `
    <div class="qty-control">
      <span class="qty-label">Quantidade</span>
      <button class="qty-btn" onclick="alterarQty(this, -1)">−</button>
      <span class="qty-display">1</span>
      <input type="hidden" class="qty-input" value="1">
      <button class="qty-btn" onclick="alterarQty(this, +1)">+</button>
    </div>`;
}

function precoItemHtml() {
  return `
    <div class="item-preco-row">
      <label>Valor (R$)</label>
      <input type="text" class="item-preco-input" placeholder="0,00" oninput="formatarValor(this); recalcularTotal()">
    </div>`;
}

function alterarQty(btn, delta) {
  const card    = btn.closest('.item-card');
  const hidden  = card.querySelector('.qty-input');
  const display = card.querySelector('.qty-display');
  let   val     = parseInt(hidden.value, 10) + delta;
  if (val < 1) val = 1;
  hidden.value        = val;
  display.textContent = val;
  recalcularTotal();
}

function recalcularTotal() {
  let soma = 0;
  document.querySelectorAll('#pratos-list .item-card, #bebidas-list .item-card').forEach(el => {
    const precoStr = el.querySelector('.item-preco-input')?.value?.replace(',', '.') || '0';
    const preco    = parseFloat(precoStr) || 0;
    const qty      = parseInt(el.querySelector('.qty-input')?.value || '1', 10);
    soma += preco * qty;
  });
  const freteVal = parseFloat(document.getElementById('frete-valor')?.value?.replace(',', '.') || '0') || 0;
  soma += freteVal;
  document.getElementById('valor-total').value = soma > 0 ? soma.toFixed(2).replace('.', ',') : '';
}

// ── FRETE AUTOCOMPLETE ──

function buildFreteAutocomplete() {
  const input    = document.getElementById('frete-bairro');
  const wrapper  = document.getElementById('frete-ac-wrapper');

  const dropdown = document.createElement('ul');
  dropdown.className = 'autocomplete-list';
  wrapper.appendChild(dropdown);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    if (!q) { dropdown.style.display = 'none'; return; }

    const matches = frete.bairros
      .filter(b => b.bairro.toLowerCase().includes(q))
      .slice(0, 6);

    if (!matches.length) { dropdown.style.display = 'none'; return; }

    matches.forEach(b => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.textContent = b.bairro + ` — R$ ${b.preco.toFixed(2).replace('.', ',')}`;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = b.bairro;
        document.getElementById('frete-valor').value = b.preco.toFixed(2).replace('.', ',');
        dropdown.style.display = 'none';
        recalcularTotal();
      });
      dropdown.appendChild(li);
    });
    dropdown.style.display = 'block';
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { dropdown.style.display = 'none'; }, 150);
  });
}

function addItem(tipo) {
  if (tipo === 'prato') {
    pratoCount++;
    const n  = pratoCount;
    const el = document.createElement('div');
    el.className = 'item-card';
    el.id = `prato-${n}`;
    el.innerHTML = `
      <span class="item-num">Prato #${n}</span>
      <button class="remove-btn" onclick="removeItem('prato-${n}')">✕ remover</button>
      ${qtyControlHtml()}
      <div style="margin-bottom:8px">
        <label>Prato</label>
        <div class="ac-wrapper">
          <input type="text" class="prato-input" placeholder="Ex: Frango ao molho...">
        </div>
      </div>
      ${precoItemHtml()}
      <div class="obs-group">
        <label>Observação</label>
        <textarea placeholder="Ex: Sem cebola, molho à parte..."></textarea>
      </div>
    `;
    document.getElementById('pratos-list').appendChild(el);
    buildAutocomplete(el.querySelector('.prato-input'), cardapio.pratos);
  } else {
    bebidaCount++;
    const n  = bebidaCount;
    const el = document.createElement('div');
    el.className = 'item-card';
    el.id = `bebida-${n}`;
    el.innerHTML = `
      <span class="item-num">Bebida #${n}</span>
      <button class="remove-btn" onclick="removeItem('bebida-${n}')">✕ remover</button>
      ${qtyControlHtml()}
      <div class="bebida-group">
        <label>Bebida</label>
        <div class="ac-wrapper">
          <input type="text" class="bebida-input" placeholder="Ex: Coca-Cola 2L gelada">
        </div>
      </div>
      ${precoItemHtml()}
    `;
    document.getElementById('bebidas-list').appendChild(el);
    buildAutocomplete(el.querySelector('.bebida-input'), cardapio.bebidas);
  }
  renumber();
}

function removeItem(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.transition = 'opacity .15s, transform .15s';
  el.style.opacity    = '0';
  el.style.transform  = 'translateX(-10px)';
  setTimeout(() => { el.remove(); renumber(); recalcularTotal(); }, 160);
}

function renumber() {
  document.querySelectorAll('#pratos-list .item-card').forEach((el, i) => {
    el.querySelector('.item-num').textContent = `Prato #${i + 1}`;
  });
  document.querySelectorAll('#bebidas-list .item-card').forEach((el, i) => {
    el.querySelector('.item-num').textContent = `Bebida #${i + 1}`;
  });
}

// ── PAGAMENTO ──

function selectPay(btn) {
  const jaSelected = btn.classList.contains('selected');
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));

  const forma = jaSelected ? '' : btn.dataset.value;
  if (!jaSelected) btn.classList.add('selected');
  document.getElementById('forma-pagamento').value = forma;

  document.getElementById('troco-group').classList.toggle('visible', forma === 'Dinheiro');
  if (forma !== 'Dinheiro') document.getElementById('troco-para').value = '';

  document.getElementById('outro-group').classList.toggle('visible', forma === 'Outro');
  if (forma !== 'Outro') document.getElementById('outro-desc').value = '';
}

// ── COLETA DE DADOS ──

function coletarDados() {
  const num   = document.getElementById('num-comanda').value.trim();
  const nome  = document.getElementById('nome-cliente').value.trim();
  const valor = document.getElementById('valor-total').value.trim();
  const troco = document.getElementById('troco-para').value.trim();
  let   forma = document.getElementById('forma-pagamento').value;

  if (forma === 'Outro') {
    const desc = document.getElementById('outro-desc').value.trim();
    forma = desc ? `Outro: ${desc}` : 'Outro';
  }

  const pratos = [...document.querySelectorAll('#pratos-list .item-card')].map(el => ({
    nome:       el.querySelector('.prato-input')?.value.trim() || '',
    obs:        el.querySelector('textarea')?.value.trim()    || '',
    quantidade: parseInt(el.querySelector('.qty-input')?.value || '1', 10),
    preco:      parseFloat(el.querySelector('.item-preco-input')?.value?.replace(',', '.') || '0') || 0
  })).filter(p => p.nome);

  const bebidas = [...document.querySelectorAll('#bebidas-list .item-card')].map(el => ({
    nome:       el.querySelector('.bebida-input')?.value.trim() || '',
    quantidade: parseInt(el.querySelector('.qty-input')?.value || '1', 10),
    preco:      parseFloat(el.querySelector('.item-preco-input')?.value?.replace(',', '.') || '0') || 0
  })).filter(b => b.nome);

  const freteBairro = document.getElementById('frete-bairro')?.value.trim() || '';
  const freteValor  = document.getElementById('frete-valor')?.value.trim() || '';

  return { num, nome, valor, forma, troco, pratos, bebidas, freteBairro, freteValor };
}

// ── TELA DE REVISÃO ──

function abrirRevisao() {
  const num  = document.getElementById('num-comanda').value.trim();
  const nome = document.getElementById('nome-cliente').value.trim();
  if (!num || !nome) { showToast('Preencha o número e o nome!'); return; }

  const dados = coletarDados();
  if (!dados.pratos.length && !dados.bebidas.length) { showToast('Adicione ao menos um item!'); return; }
  if (!dados.valor) { showToast('Informe o valor total!'); return; }
  if (!dados.forma) { showToast('Selecione a forma de pagamento!'); return; }

  const now = new Date();
  const timestamp = `Emitido: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const pratosHtml = dados.pratos.map(p => {
    const precoStr = p.preco > 0 ? `<span class="prev-item-preco">R$ ${(p.preco * p.quantidade).toFixed(2).replace('.', ',')}</span>` : '';
    return `
    <div class="prev-item">
      <div class="prev-item-linha">
        <span class="prev-qty">×${p.quantidade}</span>
        <span class="prev-item-nome">${p.nome}</span>
        ${precoStr}
      </div>
      ${p.obs ? `<div class="prev-item-obs">${p.obs}</div>` : ''}
    </div>`;
  }).join('');

  const bebidasHtml = dados.bebidas.map(b => {
    const precoStr = b.preco > 0 ? `<span class="prev-item-preco">R$ ${(b.preco * b.quantidade).toFixed(2).replace('.', ',')}</span>` : '';
    return `
    <div class="prev-item">
      <div class="prev-item-linha">
        <span class="prev-qty">×${b.quantidade}</span>
        <span class="prev-item-nome">${b.nome}</span>
        ${precoStr}
      </div>
    </div>`;
  }).join('');

  const trocoHtml = dados.troco
    ? `<div class="prev-field"><div class="prev-label">Troco para (R$)</div><div class="prev-value">${dados.troco}</div></div>`
    : '';

  document.getElementById('revisao-preview').innerHTML = `
    <div class="prev-logo">Bar do Júlio</div>
    <div class="prev-tagline">Comanda de Pedido — Delivery</div>
    <div class="prev-row">
      <div class="prev-field"><div class="prev-label">Nº da Comanda</div><div class="prev-value">#${dados.num}</div></div>
      <div class="prev-field"><div class="prev-label">Nome do Cliente</div><div class="prev-value">${dados.nome}</div></div>
    </div>
    ${pratosHtml  ? `<hr class="prev-divider"><div class="prev-section-title">🍽 Pratos</div>${pratosHtml}`   : ''}
    ${bebidasHtml ? `<hr class="prev-divider"><div class="prev-section-title">🥤 Bebidas</div>${bebidasHtml}` : ''}
    <hr class="prev-divider">
    <div class="prev-section-title">💰 Pagamento</div>
    ${dados.freteBairro || dados.freteValor ? `
    <div class="prev-item" style="border-left-color: var(--green); margin-bottom: 10px;">
      <div class="prev-item-linha">
        <span class="prev-item-nome">🚚 Frete${dados.freteBairro ? ` — ${dados.freteBairro}` : ''}</span>
        ${dados.freteValor ? `<span class="prev-item-preco">R$ ${dados.freteValor}</span>` : ''}
      </div>
    </div>` : ''}
    <div class="prev-pagamento">
      <div class="prev-field"><div class="prev-label">Valor Total</div><div class="prev-value">R$ ${dados.valor}</div></div>
      <div class="prev-field"><div class="prev-label">Forma</div><div class="prev-value">${dados.forma}</div></div>
      ${trocoHtml}
    </div>
    <div class="prev-timestamp">${timestamp}</div>
  `;

  document.getElementById('revisao-overlay').style.display = 'flex';
  window.scrollTo(0, 0);
}

function fecharRevisao() {
  document.getElementById('revisao-overlay').style.display = 'none';
}

// ── CONFIRMAR IMPRESSÃO ──

async function confirmarImpressao() {
  const dados = coletarDados();

  await salvarNoHistorico(dados); // grava no .json via IPC

  // Marca agendamento como concluído, se houver
  const params  = new URLSearchParams(window.location.search);
  const agendId = parseInt(params.get('agendId'));
  if (agendId) concluirAgendamento(agendId); // utils.js

  fecharRevisao();
  window.addEventListener('afterprint', () => window.location.reload(), { once: true });
  window.print();
}

// ── SALVAR NO HISTÓRICO ──

async function salvarNoHistorico(dados) {
  const pedido = {
    id:      Date.now(),
    hora:    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    num:     dados.num,
    nome:    dados.nome,
    pratos:  dados.pratos,
    bebidas: dados.bebidas,
    valor:   dados.valor,
    forma:   dados.forma,
    troco:   dados.troco
  };

  const hoje = dataHoje(); // utils.js
  await salvarPedidoHistorico(hoje, pedido); // utils.js → window.api.salvarPedido
  await salvarUltimaComanda(dados.num);      // utils.js → window.api.salvarConfig
}

// ── LIMPAR ──

function limpar() {
  if (!confirm('Limpar toda a comanda?')) return;
  document.getElementById('nome-cliente').value    = '';
  document.getElementById('pratos-list').innerHTML  = '';
  document.getElementById('bebidas-list').innerHTML = '';
  document.getElementById('frete-bairro').value = '';
  document.getElementById('frete-valor').value  = '';
  document.getElementById('valor-total').value  = '';
  document.getElementById('troco-para').value   = '';
  document.getElementById('outro-desc').value   = '';
  document.getElementById('forma-pagamento').value = '';
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('troco-group').classList.remove('visible');
  document.getElementById('outro-group').classList.remove('visible');
  pratoCount  = 0;
  bebidaCount = 0;
  iniciarNumComanda();
  addItem('prato');
  addItem('bebida');
  showToast('Comanda limpa!');
}

// ── NÚMERO DE COMANDA ──

async function iniciarNumComanda() {
  const num = await proximoNumComanda(); // utils.js
  document.getElementById('num-comanda').value = num;
  await atualizarHintUltimaComanda();    // utils.js
}

// ── INIT ──

// ── AGENDADOS HOJE ──

function renderAgendadosHoje() {
  const todos = carregarAgendamentos(); // utils.js
  const hoje  = dataHoje();
  const agendados = todos.filter(a => a.data === hoje && !a.concluido);

  const count   = document.getElementById('agendados-count');
  const lista   = document.getElementById('agendados-lista');
  const painel  = document.getElementById('agendados-painel');

  if (count) count.textContent = agendados.length ? `${agendados.length}` : '';

  if (!agendados.length) {
    if (painel) painel.style.display = 'none';
    return;
  }

  if (painel) painel.style.display = '';

  if (lista) {
    lista.innerHTML = agendados.map(a => {
      const horarios = [];
      if (a.horaPedido) horarios.push(`🕐 ${a.horaPedido}`);
      if (a.horaEnvio)  horarios.push(`🚀 ${a.horaEnvio}`);
      return `
        <div class="agendado-card">
          <div class="agendado-info">
            <span class="agendado-cliente">${a.cliente}</span>
            ${horarios.length ? `<span class="agendado-horarios">${horarios.join('  ·  ')}</span>` : ''}
            ${a.obs ? `<span class="agendado-obs">${a.obs}</span>` : ''}
          </div>
          <div class="agendado-acoes">
            <a class="agendado-btn-abrir" href="./index.html?cliente=${encodeURIComponent(a.cliente)}&agendId=${a.id}">abrir →</a>
          </div>
        </div>`;
    }).join('');
  }
}

// ── INIT ──

async function init() {
  cardapio = await carregarCardapioBase(); // utils.js
  frete    = await window.api.lerFrete();
  buildFreteAutocomplete();

  document.querySelectorAll('.dia-btn').forEach(btn => {
    btn.addEventListener('click', () => setDia(btn.dataset.dia));
  });
  setDia(diaAtivo);

  await iniciarNumComanda();

  renderAgendadosHoje();

  // Pré-preenche cliente vindo de um agendamento
  const params  = new URLSearchParams(window.location.search);
  const cliente = params.get('cliente');
  if (cliente) {
    document.getElementById('nome-cliente').value = cliente;
  }

  document.body.classList.add('pronto');
}

init();

