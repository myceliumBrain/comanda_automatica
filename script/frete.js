/* frete.js — configuração de frete: origem + faixas de km
   Depende de: utils.js (window.api), Leaflet (global L) */

let frete = { origem: { endereco: '', lat: null, lng: null }, faixas: [] };

let map, markerOrigem;

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// ── INIT ──

async function iniciar() {
  frete = await window.api.lerFrete();
  // Garante estrutura mínima (migração de dados antigos)
  if (!frete.origem) frete.origem = { endereco: '', lat: null, lng: null };
  if (!frete.faixas) frete.faixas = [];

  iniciarMapa();
  renderFaixas();
  restaurarOrigem();
}

// ── MAPA ──

function iniciarMapa() {
  map = L.map('map', { zoomControl: true }).setView([-15.8, -47.9], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);
}

function iconeOrigem() {
  return L.divIcon({
    html: '<div class="map-icon-origem">🏠</div>',
    className: '', iconSize: [30, 30], iconAnchor: [15, 15]
  });
}

function mostrarOrigemNoMapa(lat, lng) {
  if (markerOrigem) map.removeLayer(markerOrigem);
  markerOrigem = L.marker([lat, lng], { icon: iconeOrigem() })
    .addTo(map)
    .bindPopup('<strong>Bar do Júlio</strong><br>Ponto de origem')
    .openPopup();
  map.setView([lat, lng], 15);
}

function restaurarOrigem() {
  const { endereco, lat, lng } = frete.origem;
  if (lat != null && lng != null) {
    mostrarOrigemNoMapa(lat, lng);
    document.getElementById('origem-input').value = endereco || '';
    mostrarStatusOrigem(endereco || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
  }
}

function mostrarStatusOrigem(endereco, lat, lng) {
  const box = document.getElementById('origem-status');
  document.getElementById('origem-status-txt').textContent = endereco;
  document.getElementById('origem-coords').textContent =
    `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
  box.style.display = 'flex';
}

// ── GEOCODIFICAR ORIGEM ──

async function buscarOrigem() {
  const q = document.getElementById('origem-input').value.trim();
  if (!q) { showToast('Informe o endereço do bar!'); return; }

  try {
    const resp = await fetch(
      `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    const data = await resp.json();
    if (!data.length) { showToast('Endereço não encontrado'); return; }

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    const endereco = data[0].display_name;

    frete.origem = { endereco, lat, lng };
    await window.api.salvarFrete(frete);

    mostrarOrigemNoMapa(lat, lng);
    mostrarStatusOrigem(endereco, lat, lng);
    showToast('Origem salva!');
  } catch {
    showToast('Erro ao geocodificar endereço');
  }
}

// ── RENDER FAIXAS ──

function renderFaixas() {
  const lista = document.getElementById('faixas-lista');
  const vazio = document.getElementById('faixas-vazio');

  if (!frete.faixas.length) {
    lista.innerHTML = '';
    vazio.style.display = 'block';
    return;
  }
  vazio.style.display = 'none';

  const sorted = [...frete.faixas].sort((a, b) => a.ate_km - b.ate_km);

  lista.innerHTML = sorted.map((f, i) => {
    const de    = i === 0 ? 0 : sorted[i - 1].ate_km;
    const label = de === 0
      ? `Até ${f.ate_km.toFixed(1)} km`
      : `${de.toFixed(1)} – ${f.ate_km.toFixed(1)} km`;
    const preco = f.preco.toFixed(2).replace('.', ',');

    return `
      <div class="faixa-row" id="faixa-${f.id}">
        <div class="faixa-row-body">
          <span class="faixa-label">${label}</span>
          <span class="faixa-preco">R$ ${preco}</span>
        </div>
        <div class="faixa-row-actions">
          <button class="btn-item-edit" onclick="abrirModal(${f.id})">editar</button>
          <button class="btn-item-del"  onclick="excluir(${f.id})">excluir</button>
        </div>
      </div>`;
  }).join('');
}

// ── ADICIONAR FAIXA ──

async function adicionarFaixa() {
  const ateKm = parseFloat(document.getElementById('nova-ate-km').value);
  const preco = parseFloat(
    (document.getElementById('novo-preco').value || '0').replace(',', '.')
  ) || 0;

  if (isNaN(ateKm) || ateKm <= 0) { showToast('Informe um km válido!'); return; }
  if (preco <= 0)                  { showToast('Informe um preço válido!'); return; }

  // Não permite duplicar o mesmo ate_km
  if (frete.faixas.some(f => f.ate_km === ateKm)) {
    showToast(`Já existe uma faixa para ${ateKm} km!`); return;
  }

  const novoId = frete.faixas.length
    ? Math.max(...frete.faixas.map(f => f.id)) + 1 : 1;

  frete.faixas.push({ id: novoId, ate_km: ateKm, preco });
  await window.api.salvarFrete(frete);
  renderFaixas();

  document.getElementById('nova-ate-km').value = '';
  document.getElementById('novo-preco').value  = '';
  showToast('Faixa adicionada!');
}

// ── EXCLUIR ──

async function excluir(id) {
  const item = frete.faixas.find(f => f.id === id);
  if (!confirm(`Excluir faixa "até ${item?.ate_km} km"?`)) return;
  frete.faixas = frete.faixas.filter(f => f.id !== id);
  await window.api.salvarFrete(frete);
  renderFaixas();
  showToast('Faixa excluída.');
}

// ── MODAL ──

function abrirModal(id) {
  const item = frete.faixas.find(f => f.id === id);
  if (!item) return;
  document.getElementById('edit-id').value     = id;
  document.getElementById('edit-ate-km').value = item.ate_km.toFixed(1);
  document.getElementById('edit-preco').value  = item.preco.toFixed(2).replace('.', ',');
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('edit-ate-km').focus();
}

function fecharModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

async function salvarEdicao() {
  const id    = parseInt(document.getElementById('edit-id').value, 10);
  const ateKm = parseFloat(document.getElementById('edit-ate-km').value);
  const preco = parseFloat(
    (document.getElementById('edit-preco').value || '0').replace(',', '.')
  ) || 0;

  if (isNaN(ateKm) || ateKm <= 0) { showToast('Informe um km válido!'); return; }
  if (preco <= 0)                  { showToast('Informe um preço válido!'); return; }

  const item = frete.faixas.find(f => f.id === id);
  if (!item) return;
  item.ate_km = ateKm;
  item.preco  = preco;

  await window.api.salvarFrete(frete);
  renderFaixas();
  document.getElementById('modal-overlay').style.display = 'none';
  showToast('Faixa atualizada!');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter'  && document.getElementById('modal-overlay').style.display !== 'none') salvarEdicao();
  if (e.key === 'Escape') document.getElementById('modal-overlay').style.display = 'none';
});

iniciar();
