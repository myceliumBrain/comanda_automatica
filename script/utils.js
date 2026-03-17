/* ═══════════════════════════════════════
   UTILS.JS — Bar do Júlio
   Compartilhado por todas as páginas

   No Electron: usa window.api (IPC → Node.js → arquivos .json)
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

// ── CARDÁPIO ──
// Cardápio padrão embutido — usado quando data/cardapio.json ainda não existe.
// Após qualquer edição no Editor, o arquivo JSON passa a ser a fonte de verdade.

const CARDAPIO_PADRAO = {
  pratos: [
    { id: 1, nome: "Frango ao molho com arroz e feijão",      preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 2, nome: "Picanha na brasa com fritas",              preco: 0, disponibilidade: ["sexta","sabado","domingo"] },
    { id: 3, nome: "Filé de tilápia grelhado com salada",      preco: 0, disponibilidade: ["segunda","quarta","sexta"] },
    { id: 4, nome: "Feijoada completa",                        preco: 0, disponibilidade: ["sabado"] },
    { id: 5, nome: "Parmegiana de frango com arroz",           preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta"] },
    { id: 6, nome: "Costela assada com mandioca",              preco: 0, disponibilidade: ["domingo"] },
    { id: 7, nome: "Misto quente",                             preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 8, nome: "Pastel de carne com caldo de cana",        preco: 0, disponibilidade: ["quarta","sabado"] }
  ],
  bebidas: [
    { id: 1,  nome: "Coca-Cola 2L",                            preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 2,  nome: "Coca-Cola lata 350ml",                    preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 3,  nome: "Guaraná Antarctica 2L",                   preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 4,  nome: "Guaraná Antarctica lata 350ml",           preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 5,  nome: "Água mineral 500ml sem gás",              preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 6,  nome: "Água mineral 500ml com gás",              preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 7,  nome: "Suco de laranja natural 500ml",           preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta"] },
    { id: 8,  nome: "Cerveja Heineken 600ml",                  preco: 0, disponibilidade: ["quinta","sexta","sabado","domingo"] },
    { id: 9,  nome: "Cerveja Skol lata 350ml",                 preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 10, nome: "Cerveja Brahma lata 350ml",               preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] },
    { id: 11, nome: "Caipirinha de limão",                     preco: 0, disponibilidade: ["quinta","sexta","sabado","domingo"] },
    { id: 12, nome: "Suco de maracujá 400ml",                  preco: 0, disponibilidade: ["segunda","terca","quarta","quinta","sexta"] }
  ]
};

// Carrega cardápio: tenta o arquivo JSON salvo, cai no padrão se não existir
async function carregarCardapioBase() {
  const salvo = await window.api.lerCardapio();
  if (salvo) return salvo;
  return JSON.parse(JSON.stringify(CARDAPIO_PADRAO)); // deep copy do padrão
}

// Salva cardápio no arquivo JSON via IPC
async function salvarCardapioLocal(cardapio) {
  await window.api.salvarCardapio(cardapio);
}

// ── HISTÓRICO ──

// Retorna pedidos de um dia (YYYY-MM-DD)
async function lerHistorico(data) {
  return await window.api.lerHistorico(data);
}

// Adiciona um pedido ao histórico do dia
async function salvarPedidoHistorico(data, pedido) {
  await window.api.salvarPedido(data, pedido);
}

// Apaga todos os pedidos de um dia
async function limparHistoricoDia(data) {
  await window.api.limparHistorico(data);
}

// ── NÚMERO DE COMANDA ──
// Lido e escrito em data/config.json via IPC

async function proximoNumComanda() {
  const config = await window.api.lerConfig();
  return (parseInt(config.ultima_comanda || '0', 10)) + 1;
}

async function salvarUltimaComanda(num) {
  await window.api.salvarConfig('ultima_comanda', num);
}

async function atualizarHintUltimaComanda() {
  const config = await window.api.lerConfig();
  const hint   = document.getElementById('hint-ultima-comanda');
  if (hint) hint.textContent = config.ultima_comanda ? `última: #${config.ultima_comanda}` : '';
}

// ── AGENDAMENTOS ──
// Salvos em localStorage — acesso imediato, sem IPC

const AGEND_KEY = 'agendamentos_bar_julio';

function carregarAgendamentos() {
  try {
    return JSON.parse(localStorage.getItem(AGEND_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function _salvarAgendamentos(lista) {
  localStorage.setItem(AGEND_KEY, JSON.stringify(lista));
}

function criarAgendamento({ cliente, data, obs, horaPedido, horaEnvio }) {
  const lista = carregarAgendamentos();
  lista.push({
    id:         Date.now(),
    cliente,
    data,
    obs,
    horaPedido,
    horaEnvio,
    concluido:  false
  });
  _salvarAgendamentos(lista);
}

function deletarAgendamento(id) {
  const lista = carregarAgendamentos().filter(a => a.id !== id);
  _salvarAgendamentos(lista);
}

function concluirAgendamento(id) {
  const lista = carregarAgendamentos().map(a =>
    a.id === id ? { ...a, concluido: true } : a
  );
  _salvarAgendamentos(lista);
}

// ── FORMATOS DE DATA ──

function formatarDataBR(dataISO) {
  // "YYYY-MM-DD" → "DD/MM/AAAA (dia-semana)"
  const [ano, mes, dia] = dataISO.split('-');
  const d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  const diaSemana = DIAS_LABEL_LONGO[DIAS[d.getDay()]];
  return `${dia}/${mes}/${ano} (${diaSemana})`;
}