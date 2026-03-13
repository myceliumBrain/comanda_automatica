/* ═══════════════════════════════════════
   UTILS.JS — Bar do Júlio
   Compartilhado por todas as páginas
   ═══════════════════════════════════════ */

// ── TOAST ──

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── DATAS ──

function dataHoje() {
  return new Date().toISOString().slice(0, 10);
}

function chaveHoje() {
  return `historico_${dataHoje()}`;
}

function chaveData(data) {
  return `historico_${data}`;
}

// ── MOEDA ──

function formatarValor(input) {
  let val = input.value.replace(/\D/g, '');
  if (!val) { input.value = ''; return; }
  val = (parseInt(val, 10) / 100).toFixed(2);
  input.value = val.replace('.', ',');
}

// ── DIAS DA SEMANA ──

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const DIAS_LABEL_CURTO = {
  domingo: 'DOM', segunda: 'SEG', terca: 'TER',
  quarta: 'QUA', quinta: 'QUI', sexta: 'SEX', sabado: 'SÁB'
};

const DIAS_LABEL_LONGO = {
  domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira',
  quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado'
};

function diaAtualSistema() {
  return DIAS[new Date().getDay()];
}

// ── CARDÁPIO (localStorage com fallback para JSON) ──

const CHAVE_CARDAPIO = 'cardapio_editado';

async function carregarCardapioBase() {
  const salvo = localStorage.getItem(CHAVE_CARDAPIO);
  if (salvo) {
    try { return JSON.parse(salvo); } catch (e) {}
  }
  try {
    const res = await fetch('./cardapio.json');
    return await res.json();
  } catch (e) {
    console.warn('Não foi possível carregar cardapio.json:', e);
    return { pratos: [], bebidas: [] };
  }
}

function salvarCardapioLocal(cardapio) {
  localStorage.setItem(CHAVE_CARDAPIO, JSON.stringify(cardapio));
}

// ── NÚMERO DE COMANDA ──

const CHAVE_ULTIMA_COMANDA = 'ultima_comanda';

function proximoNumComanda() {
  const ultimo = parseInt(localStorage.getItem(CHAVE_ULTIMA_COMANDA) || '0', 10);
  return ultimo + 1;
}

function salvarUltimaComanda(num) {
  localStorage.setItem(CHAVE_ULTIMA_COMANDA, num);
}

function atualizarHintUltimaComanda() {
  const ultimo = localStorage.getItem(CHAVE_ULTIMA_COMANDA);
  const hint = document.getElementById('hint-ultima-comanda');
  if (hint) hint.textContent = ultimo ? `última: #${ultimo}` : '';
}