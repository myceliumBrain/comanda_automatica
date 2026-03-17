/* frete.js — lógica do editor de frete
   Depende de: utils.js (window.api via preload) */

let frete = { bairros: [] };

// ── INIT ──

async function iniciar() {
  frete = await window.api.lerFrete();
  renderLista();
}

// ── SALVAR ──

async function salvarLocal() {
  await window.api.salvarFrete(frete);
}

// ── RENDER ──

function renderLista() {
  const lista  = document.getElementById('frete-lista');
  const vazio  = document.getElementById('frete-vazio');
  const count  = document.getElementById('frete-count');

  count.textContent = frete.bairros.length
    ? `${frete.bairros.length} bairro${frete.bairros.length > 1 ? 's' : ''}`
    : '';

  if (!frete.bairros.length) {
    lista.innerHTML = '';
    vazio.style.display = 'block';
    return;
  }

  vazio.style.display = 'none';

  // Ordena alfabeticamente
  const ordenados = [...frete.bairros].sort((a, b) => a.bairro.localeCompare(b.bairro, 'pt-BR'));

  lista.innerHTML = ordenados.map(b => `
    <div class="frete-row" id="bairro-${b.id}">
      <div class="frete-row-body" onclick="abrirModal(${b.id})">
        <span class="frete-bairro">${b.bairro}</span>
        <span class="frete-preco">R$ ${b.preco.toFixed(2).replace('.', ',')}</span>
      </div>
      <div class="frete-row-actions">
        <button class="btn-item-edit" onclick="abrirModal(${b.id})">editar</button>
        <button class="btn-item-del"  onclick="excluir(${b.id})">excluir</button>
      </div>
    </div>
  `).join('');
}

// ── ADICIONAR ──

async function adicionarBairro() {
  const bairro = document.getElementById('novo-bairro').value.trim();
  const preco  = parseFloat(document.getElementById('novo-preco').value || '0') || 0;

  if (!bairro) { showToast('Informe o nome do bairro!'); return; }

  const novoId = frete.bairros.length ? Math.max(...frete.bairros.map(b => b.id)) + 1 : 1;
  frete.bairros.push({ id: novoId, bairro, preco });

  await salvarLocal();
  renderLista();

  document.getElementById('novo-bairro').value = '';
  document.getElementById('novo-preco').value  = '';
  showToast('Bairro adicionado!');
}

// ── EXCLUIR ──

async function excluir(id) {
  const item = frete.bairros.find(b => b.id === id);
  if (!confirm(`Excluir "${item?.bairro}"?`)) return;
  frete.bairros = frete.bairros.filter(b => b.id !== id);
  await salvarLocal();
  renderLista();
  showToast('Bairro excluído.');
}

// ── MODAL ──

function abrirModal(id) {
  const item = frete.bairros.find(b => b.id === id);
  if (!item) return;
  document.getElementById('edit-id').value     = id;
  document.getElementById('edit-bairro').value = item.bairro;
  document.getElementById('edit-preco').value  = item.preco;
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('edit-bairro').focus();
}

function fecharModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

async function salvarEdicao() {
  const id     = parseInt(document.getElementById('edit-id').value, 10);
  const bairro = document.getElementById('edit-bairro').value.trim();
  const preco  = parseFloat(document.getElementById('edit-preco').value || '0') || 0;

  if (!bairro) { showToast('Informe o nome do bairro!'); return; }

  const item = frete.bairros.find(b => b.id === id);
  if (!item) return;

  item.bairro = bairro;
  item.preco  = preco;

  await salvarLocal();
  renderLista();
  document.getElementById('modal-overlay').style.display = 'none';
  showToast('Bairro atualizado!');
}

// Enter no modal salva
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('modal-overlay').style.display !== 'none') {
    salvarEdicao();
  }
  if (e.key === 'Escape') {
    document.getElementById('modal-overlay').style.display = 'none';
  }
});

iniciar();
