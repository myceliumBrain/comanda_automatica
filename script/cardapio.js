/* cardapio.js — lógica específica do editor de cardápio
   Depende de: utils.js                                  */

let cardapio = { pratos: [], bebidas: [] };

// ── CARREGAR / SALVAR ──

async function iniciar() {
  cardapio = await carregarCardapioBase();  // utils.js
  renderTudo();
}

function salvarLocal() {
  salvarCardapioLocal(cardapio);  // utils.js
}

// ── RENDER ──

function renderTudo() {
  renderLista('prato');
  renderLista('bebida');
}

function renderLista(tipo) {
  const lista      = tipo === 'prato' ? cardapio.pratos : cardapio.bebidas;
  const containerId = tipo === 'prato' ? 'list-pratos'   : 'list-bebidas';
  const countId     = tipo === 'prato' ? 'count-pratos'  : 'count-bebidas';
  const container   = document.getElementById(containerId);

  document.getElementById(countId).textContent =
    `${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`;

  container.innerHTML = '';
  lista.forEach(item => {
    const diasHtml = Object.entries(DIAS_LABEL_CURTO).map(([d, label]) => `
      <span class="dia-tag ${item.disponibilidade?.includes(d) ? 'ativo' : ''}">${label}</span>
    `).join('');

    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-row-body" onclick="abrirModal('${tipo}', ${item.id})">
        <div class="item-nome">${item.nome}</div>
        <div class="item-dias">${diasHtml}</div>
      </div>
      <div class="item-row-actions">
        <button class="btn-item-edit" onclick="abrirModal('${tipo}', ${item.id})">editar</button>
        <button class="btn-item-del"  onclick="excluirItem('${tipo}', ${item.id})">excluir</button>
      </div>
    `;
    container.appendChild(row);
  });
}

// ── ADICIONAR ──

function adicionarItem(tipo) {
  const nomeId = tipo === 'prato' ? 'new-prato-nome' : 'new-bebida-nome';
  const diasId = tipo === 'prato' ? 'dias-prato'     : 'dias-bebida';

  const nome = document.getElementById(nomeId).value.trim();
  if (!nome) { showToast('Digite o nome do item!'); return; }  // utils.js

  const dias = getDiasSelecionados(diasId);
  if (!dias.length) { showToast('Selecione ao menos um dia!'); return; }

  const lista  = tipo === 'prato' ? cardapio.pratos : cardapio.bebidas;
  const novoId = lista.length ? Math.max(...lista.map(i => i.id)) + 1 : 1;

  lista.push({ id: novoId, nome, disponibilidade: dias });
  salvarLocal();
  renderLista(tipo);

  document.getElementById(nomeId).value = '';
  document.querySelectorAll(`#${diasId} input`).forEach(cb => cb.checked = false);
  showToast(`${tipo === 'prato' ? 'Prato' : 'Bebida'} adicionado!`);
}

// ── EXCLUIR ──

function excluirItem(tipo, id) {
  const lista = tipo === 'prato' ? cardapio.pratos : cardapio.bebidas;
  const nome  = lista.find(i => i.id === id)?.nome || 'este item';
  if (!confirm(`Excluir "${nome}"?`)) return;

  if (tipo === 'prato') cardapio.pratos  = cardapio.pratos.filter(i => i.id !== id);
  else                  cardapio.bebidas = cardapio.bebidas.filter(i => i.id !== id);

  salvarLocal();
  renderLista(tipo);
  showToast('Item excluído!');
}

// ── MODAL DE EDIÇÃO ──

function abrirModal(tipo, id) {
  const item = (tipo === 'prato' ? cardapio.pratos : cardapio.bebidas).find(i => i.id === id);
  if (!item) return;

  document.getElementById('edit-tipo').value = tipo;
  document.getElementById('edit-id').value   = id;
  document.getElementById('edit-nome').value = item.nome;

  document.querySelectorAll('#dias-edit input').forEach(cb => {
    cb.checked = item.disponibilidade?.includes(cb.value) || false;
  });

  document.getElementById('modal-overlay').style.display = 'flex';
}

function fecharModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

function salvarEdicao() {
  const tipo = document.getElementById('edit-tipo').value;
  const id   = parseInt(document.getElementById('edit-id').value, 10);
  const nome = document.getElementById('edit-nome').value.trim();
  const dias = getDiasSelecionados('dias-edit');

  if (!nome) { showToast('Digite o nome!'); return; }
  if (!dias.length) { showToast('Selecione ao menos um dia!'); return; }

  const item = (tipo === 'prato' ? cardapio.pratos : cardapio.bebidas).find(i => i.id === id);
  if (!item) return;

  item.nome = nome;
  item.disponibilidade = dias;

  salvarLocal();
  renderLista(tipo);
  document.getElementById('modal-overlay').style.display = 'none';
  showToast('Item atualizado!');
}

// ── EXPORTAR JSON ──

function exportarJSON() {
  const blob = new Blob([JSON.stringify(cardapio, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'cardapio.json' });
  a.click();
  URL.revokeObjectURL(url);
  showToast('cardapio.json exportado!');
}

// ── UTILIDADES ──

function getDiasSelecionados(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map(cb => cb.value);
}

function toggleTodos(containerId) {
  const cbs = [...document.querySelectorAll(`#${containerId} input`)];
  const todos = cbs.every(cb => cb.checked);
  cbs.forEach(cb => cb.checked = !todos);
}

// ── INIT ──

iniciar();