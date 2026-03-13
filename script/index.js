/* index.js — lógica específica da comanda principal
   Depende de: utils.js                             */

let pratoCount  = 0;
let bebidaCount = 0;
let cardapio    = { pratos: [], bebidas: [] };

let diaAtivo = diaAtualSistema();  // utils.js

// ── PAINEL DO DIA ──

function setDia(dia) {
  diaAtivo = dia;
  document.querySelectorAll('.dia-btn').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.dia === dia);
  });
  if (document.getElementById('cardapio-dia').classList.contains('aberto')) {
    renderCardapioDia();
  }
}

function toggleCardapioDia() {
  const painel = document.getElementById('cardapio-dia');
  const toggle = document.getElementById('dia-toggle');
  const aberto = painel.classList.toggle('aberto');
  toggle.classList.toggle('aberto', aberto);
  toggle.textContent = aberto ? 'fechar cardápio ▴' : 'ver cardápio ▾';
  if (aberto) renderCardapioDia();
}

function renderCardapioDia() {
  const pratos  = cardapio.pratos.filter(p  => !p.disponibilidade  || p.disponibilidade.includes(diaAtivo));
  const bebidas = cardapio.bebidas.filter(b => !b.disponibilidade || b.disponibilidade.includes(diaAtivo));

  const itemHtml = nome => `<div class="cardapio-item">• ${nome}</div>`;
  const vazio    = msg  => `<div class="cardapio-vazio">${msg}</div>`;

  document.getElementById('cardapio-dia-inner').innerHTML = `
    <div class="cardapio-col">
      <div class="cardapio-col-title">🍽 Pratos</div>
      ${pratos.length  ? pratos.map(p => itemHtml(p.nome)).join('')  : vazio('Nenhum prato disponível')}
    </div>
    <div class="cardapio-col">
      <div class="cardapio-col-title">🥤 Bebidas</div>
      ${bebidas.length ? bebidas.map(b => itemHtml(b.nome)).join('') : vazio('Nenhuma bebida disponível')}
    </div>
  `;
}

function filtrarDisponivel(lista) {
  return lista.filter(item => !item.disponibilidade || item.disponibilidade.includes(diaAtivo));
}

// ── PAINEL AGENDADOS DO DIA ──

function renderAgendadosDia() {
  const painel = document.getElementById('agendados-painel');
  if (!painel) return;

  const lista           = agendamentosHoje(); // utils.js
  const listaContainer  = document.getElementById('agendados-lista');
  const contagem        = document.getElementById('agendados-count');

  const pendentes  = lista.filter(a => !a.concluido);
  const concluidos = lista.filter(a =>  a.concluido);

  if (contagem) {
    if (pendentes.length) {
      contagem.textContent = `${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}`;
      contagem.className   = 'agendados-count pendente';
    } else if (concluidos.length) {
      contagem.textContent = 'todos atendidos ✓';
      contagem.className   = 'agendados-count todos-ok';
    } else {
      contagem.textContent = '';
      contagem.className   = 'agendados-count';
    }
  }

  if (!lista.length) {
    listaContainer.innerHTML = `<div class="agendados-vazio">Nenhum agendamento para hoje</div>`;
    return;
  }

  listaContainer.innerHTML = lista.map(a => {
    const horarios = [];
    if (a.horaPedido) horarios.push(`🕐 ${a.horaPedido}`);
    if (a.horaEnvio)  horarios.push(`🚀 ${a.horaEnvio}`);
    const horariosHtml = horarios.length
      ? `<span class="agendado-horarios">${horarios.join(' · ')}</span>`
      : '';
    return `
    <div class="agendado-card ${a.concluido ? 'concluido' : ''}" id="agendado-${a.id}">
      <div class="agendado-info">
        <span class="agendado-cliente">${a.cliente}</span>
        ${horariosHtml}
        ${a.obs ? `<span class="agendado-obs">${a.obs}</span>` : ''}
      </div>
      <div class="agendado-acoes">
        ${!a.concluido
          ? `<button class="agendado-btn-abrir" onclick="abrirComandaAgendada(${a.id}, '${escaparAttr(a.cliente)}')">abrir comanda →</button>`
          : `<span class="agendado-tag-concluido">✓ concluído</span>`
        }
      </div>
    </div>
  `;
  }).join('');
}

function escaparAttr(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function abrirComandaAgendada(id, cliente) {
  document.getElementById('nome-cliente').value = cliente;
  window._agendamentoAtivoId = id;
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('nome-cliente').focus(), 400);
  showToast(`Comanda aberta para ${cliente}`);
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
      li.textContent = item.nome;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = item.nome;
        dropdown.style.display = 'none';
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

function addItem(tipo) {
  if (tipo === 'prato') {
    pratoCount++;
    const n  = pratoCount;
    const el = document.createElement('div');
    el.className = 'item-card';
    el.id = `prato-${n}`;
    el.innerHTML = `
      <div class="item-num">Prato #${n}</div>
      <button class="remove-btn" onclick="removeItem('prato-${n}')">✕ remover</button>
      <div style="margin-bottom:8px">
        <label>Prato</label>
        <div class="ac-wrapper">
          <input type="text" class="prato-input" placeholder="Ex: Frango ao molho...">
        </div>
      </div>
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
      <div class="item-num">Bebida #${n}</div>
      <button class="remove-btn" onclick="removeItem('bebida-${n}')">✕ remover</button>
      <div class="bebida-group">
        <label>Bebida</label>
        <div class="ac-wrapper">
          <input type="text" class="bebida-input" placeholder="Ex: Coca-Cola 2L gelada">
        </div>
      </div>
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
  setTimeout(() => { el.remove(); renumber(); }, 160);
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
    nome: el.querySelector('.prato-input')?.value.trim() || '',
    obs:  el.querySelector('textarea')?.value.trim()    || ''
  })).filter(p => p.nome);

  const bebidas = [...document.querySelectorAll('#bebidas-list .item-card')].map(el => ({
    nome: el.querySelector('.bebida-input')?.value.trim() || ''
  })).filter(b => b.nome);

  return { num, nome, valor, forma, troco, pratos, bebidas };
}

// ── TELA DE REVISÃO ──

function abrirRevisao() {
  const num  = document.getElementById('num-comanda').value.trim();
  const nome = document.getElementById('nome-cliente').value.trim();
  if (!num || !nome)                    { showToast('Preencha o número e o nome!'); return; }

  const dados = coletarDados();
  if (!dados.pratos.length && !dados.bebidas.length) { showToast('Adicione ao menos um item!'); return; }
  if (!dados.valor)                     { showToast('Informe o valor total!'); return; }
  if (!dados.forma)                     { showToast('Selecione a forma de pagamento!'); return; }

  const now = new Date();
  const timestamp = `Emitido: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const pratosHtml = dados.pratos.map(p => `
    <div class="prev-item">
      <div class="prev-item-nome">${p.nome}</div>
      ${p.obs ? `<div class="prev-item-obs">${p.obs}</div>` : ''}
    </div>`).join('');

  const bebidasHtml = dados.bebidas.map(b => `
    <div class="prev-item"><div class="prev-item-nome">${b.nome}</div></div>`).join('');

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
    ${pratosHtml  ? `<hr class="prev-divider"><div class="prev-section-title">Pratos</div>${pratosHtml}`   : ''}
    ${bebidasHtml ? `<hr class="prev-divider"><div class="prev-section-title">Bebidas</div>${bebidasHtml}` : ''}
    <hr class="prev-divider">
    <div class="prev-section-title">Pagamento</div>
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

function confirmarImpressao() {
  const dados = coletarDados();

  salvarNoHistorico(dados);

  // Se esta comanda veio de um agendamento, marca como concluído
  if (window._agendamentoAtivoId) {
    marcarAgendamentoConcluido(window._agendamentoAtivoId); // utils.js
    window._agendamentoAtivoId = null;
    renderAgendadosDia();
  }

  // Captura o HTML do preview de revisão (já está gerado e perfeito)
  const previewHtml = document.getElementById('revisao-preview').innerHTML;

  // Abre janela de impressão isolada com apenas o conteúdo do preview
  const janela = window.open('', '_blank', 'width=420,height=600');
  janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comanda</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    @page { size: 80mm auto; margin: 6mm 4mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.82rem;
      line-height: 1.55;
      padding: 12px 14px;
    }
    .prev-logo {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 2rem;
      letter-spacing: 0.08em;
      text-align: center;
      line-height: 1;
    }
    .prev-tagline {
      font-size: 0.58rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      text-align: center;
      margin-top: 3px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid #000;
    }
    .prev-row {
      display: flex;
      gap: 16px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .prev-field { flex: 1; }
    .prev-label {
      font-size: 0.54rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .prev-value {
      font-size: 0.88rem;
      font-weight: 700;
      border-bottom: 1px dashed #999;
      padding-bottom: 2px;
    }
    .prev-divider {
      border: none;
      border-top: 1px dashed #999;
      margin: 10px 0;
    }
    .prev-section-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 0.95rem;
      letter-spacing: 0.1em;
      margin-bottom: 6px;
    }
    .prev-item {
      border-left: 3px solid #000;
      padding: 5px 9px;
      margin-bottom: 5px;
    }
    .prev-item-nome { font-size: 0.82rem; }
    .prev-item-obs {
      font-size: 0.72rem;
      font-style: italic;
      margin-top: 2px;
      padding-left: 7px;
      border-left: 2px solid #999;
    }
    .prev-pagamento { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; }
    .prev-timestamp {
      font-size: 0.58rem;
      text-align: right;
      margin-top: 12px;
      letter-spacing: 0.12em;
    }
  </style>
</head>
<body>
  ${previewHtml}
</body>
</html>`);

  janela.document.close();

  // Aguarda fontes carregarem antes de imprimir
  janela.onload = () => {
    janela.focus();
    janela.print();
    janela.addEventListener('afterprint', () => janela.close(), { once: true });
  };

  fecharRevisao();
  limparSemConfirmar();
}

// Limpa a comanda silenciosamente após imprimir (sem confirm)
function limparSemConfirmar() {
  document.getElementById('nome-cliente').value    = '';
  document.getElementById('pratos-list').innerHTML  = '';
  document.getElementById('bebidas-list').innerHTML = '';
  document.getElementById('valor-total').value   = '';
  document.getElementById('troco-para').value    = '';
  document.getElementById('outro-desc').value    = '';
  document.getElementById('forma-pagamento').value = '';
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('troco-group').classList.remove('visible');
  document.getElementById('outro-group').classList.remove('visible');
  pratoCount  = 0;
  bebidaCount = 0;
  window._agendamentoAtivoId = null;
  iniciarNumComanda();
  addItem('prato');
  addItem('bebida');
}

// ── HISTÓRICO ──

function salvarNoHistorico(dados) {
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

  const chave    = chaveHoje();           // utils.js
  const historico = JSON.parse(localStorage.getItem(chave) || '[]');
  historico.push(pedido);
  localStorage.setItem(chave, JSON.stringify(historico));

  salvarUltimaComanda(dados.num);         // utils.js
}

// ── LIMPAR ──

function limpar() {
  if (!confirm('Limpar toda a comanda?')) return;
  document.getElementById('nome-cliente').value = '';
  document.getElementById('pratos-list').innerHTML  = '';
  document.getElementById('bebidas-list').innerHTML = '';
  document.getElementById('valor-total').value  = '';
  document.getElementById('troco-para').value   = '';
  document.getElementById('outro-desc').value   = '';
  document.getElementById('forma-pagamento').value = '';
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('troco-group').classList.remove('visible');
  document.getElementById('outro-group').classList.remove('visible');
  pratoCount  = 0;
  bebidaCount = 0;
  window._agendamentoAtivoId = null;
  iniciarNumComanda();
  addItem('prato');
  addItem('bebida');
  showToast('Comanda limpa!');
}

// ── COMANDA ──

function iniciarNumComanda() {
  document.getElementById('num-comanda').value = proximoNumComanda();  // utils.js
  atualizarHintUltimaComanda();                                        // utils.js
}

// ── INIT ──

carregarCardapioBase().then(c => {  // utils.js
  cardapio = c;

  document.querySelectorAll('.dia-btn').forEach(btn => {
    btn.addEventListener('click', () => setDia(btn.dataset.dia));
  });
  setDia(diaAtivo);

  iniciarNumComanda();
  addItem('prato');
  addItem('bebida');

  // Renderiza agendados do dia
  renderAgendadosDia();

  // Se vier da página de agendamentos com cliente pré-definido via URL
  const params = new URLSearchParams(window.location.search);
  const clienteParam = params.get('cliente');
  const agendIdParam = params.get('agendId');
  if (clienteParam) {
    document.getElementById('nome-cliente').value = decodeURIComponent(clienteParam);
    if (agendIdParam) window._agendamentoAtivoId = parseInt(agendIdParam, 10);
  }

  // Exibe a página com fade-in suave (evita flash de layout)
  requestAnimationFrame(() => {
    document.body.classList.add('pronto');
  });
});