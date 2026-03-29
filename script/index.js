/* index.js — lógica da comanda principal
   Depende de: utils.js (window.api já disponível via preload) */

let pratoCount  = 0;
let bebidaCount = 0;
let cardapio    = { pratos: [], bebidas: [] };
let frete       = { bairros: [] };
let _freteMode  = 'auto';

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
  const faixas = frete.faixas || [];
  if (!faixas.length) {
    inner.innerHTML = '<div class="frete-panel-vazio">Nenhuma faixa configurada.</div>';
    return;
  }
  const sorted = [...faixas].sort((a, b) => a.ate_km - b.ate_km);
  inner.innerHTML = sorted.map((f, i) => {
    const de    = i === 0 ? 0 : sorted[i - 1].ate_km;
    const label = de === 0
      ? `Até ${f.ate_km.toFixed(1)} km`
      : `${de.toFixed(1)} – ${f.ate_km.toFixed(1)} km`;
    return `
      <div class="frete-panel-row">
        <span class="frete-panel-bairro">${label}</span>
        <span class="frete-panel-preco">R$ ${f.preco.toFixed(2).replace('.', ',')}</span>
      </div>`;
  }).join('');
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

// ── MAPA DE ROTA ──

let _freteMap      = null;
let _freteMarkers  = [];
let _fretePolyline = null;

function _iconeOrigem() {
  return L.divIcon({
    html: '<div class="fm-origem"></div>',
    className: '', iconSize: [18, 18], iconAnchor: [9, 9]
  });
}

function _iconeDestino() {
  return L.divIcon({
    html: `<div class="fm-destino">
      <svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 0C4.9 0 0 4.9 0 11c0 8.3 11 19 11 19s11-10.7 11-19C22 4.9 17.1 0 11 0z"
              fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
        <circle cx="11" cy="11" r="4.5" fill="#fff"/>
      </svg>
    </div>`,
    className: '', iconSize: [22, 30], iconAnchor: [11, 30]
  });
}

function _renderizarMapa(oLat, oLng, dLat, dLng, coords) {
  const el = document.getElementById('frete-mapa');
  el.style.display = 'block';

  if (!_freteMap) {
    _freteMap = L.map('frete-mapa', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
     .addTo(_freteMap);
    L.control.zoom({ position: 'bottomright' }).addTo(_freteMap);
  }

  // Limpa camadas anteriores
  _freteMarkers.forEach(m => _freteMap.removeLayer(m));
  _freteMarkers = [];
  if (_fretePolyline) { _freteMap.removeLayer(_fretePolyline); _fretePolyline = null; }

  // Rota ou linha reta
  if (coords && coords.length > 1) {
    // OSRM retorna [lng, lat] — inverte para Leaflet [lat, lng]
    const latlngs = coords.map(c => [c[1], c[0]]);
    _fretePolyline = L.polyline(latlngs, {
      color: '#e67e22', weight: 5, opacity: 0.85, lineJoin: 'round'
    }).addTo(_freteMap);
  } else {
    _fretePolyline = L.polyline([[oLat, oLng], [dLat, dLng]], {
      color: '#e67e22', weight: 4, opacity: 0.7, dashArray: '10,6'
    }).addTo(_freteMap);
  }

  // Marcadores
  const mOrig = L.marker([oLat, oLng], { icon: _iconeOrigem(), zIndexOffset: 10 })
    .addTo(_freteMap).bindTooltip('Bar do Júlio', { permanent: false });
  const mDest = L.marker([dLat, dLng], { icon: _iconeDestino(), zIndexOffset: 20 })
    .addTo(_freteMap).bindTooltip('Entrega', { permanent: false });

  _freteMarkers = [mOrig, mDest];

  // Ajusta zoom para mostrar toda a rota
  const bounds = _fretePolyline.getBounds().extend([oLat, oLng]).extend([dLat, dLng]);
  _freteMap.fitBounds(bounds, { padding: [28, 28] });
  _freteMap.invalidateSize();
}

// ── MODO FRETE ──

function setFreteMode(mode) {
  _freteMode = mode;
  document.getElementById('btn-modo-auto').classList.toggle('ativo',   mode === 'auto');
  document.getElementById('btn-modo-manual').classList.toggle('ativo', mode === 'manual');
  const calcBtn = document.getElementById('btn-calc-frete');
  if (calcBtn) calcBtn.style.display = mode === 'auto' ? '' : 'none';
  if (mode === 'manual') {
    document.getElementById('frete-resultado').style.display = 'none';
    document.getElementById('frete-mapa').style.display      = 'none';
  }
}

function removerEntrega() {
  document.getElementById('frete-endereco').value            = '';
  document.getElementById('frete-valor').value               = '';
  document.getElementById('frete-resultado').style.display    = 'none';
  document.getElementById('frete-mapa').style.display         = 'none';
  document.getElementById('btn-remover-entrega').style.display = 'none';
  if (_freteMarkers)  { _freteMarkers.forEach(m => _freteMap?.removeLayer(m)); _freteMarkers = []; }
  if (_fretePolyline) { _freteMap?.removeLayer(_fretePolyline); _fretePolyline = null; }
  recalcularTotal();
}

// ── HELPERS DE FRETE ──

// Bounding box de 30 km ao redor da origem (para limitar busca Nominatim)
function _bbox30km(oLat, oLng) {
  const dLat = 30 / 111;
  const dLng = 30 / (111 * Math.cos(oLat * Math.PI / 180));
  return `${oLng - dLng},${oLat - dLat},${oLng + dLng},${oLat + dLat}`;
}

// Encurta o display_name do Nominatim para exibição
function _nomeCurto(displayName) {
  return displayName.split(',').slice(0, 3).map(s => s.trim()).join(', ');
}

// Debounce
function _debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Calcula rota + preenche campos + renderiza mapa (já com coords conhecidas)
async function _aplicarRota(dLat, dLng) {
  const origem = frete.origem;
  const oLat   = parseFloat(origem.lat);
  const oLng   = parseFloat(origem.lng);

  let km, rotaCoords = null;
  try {
    const rResp = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}` +
      `?overview=full&geometries=geojson`
    );
    const rData = await rResp.json();
    if (rData.code !== 'Ok') throw new Error();
    km         = rData.routes[0].distance / 1000;
    rotaCoords = rData.routes[0].geometry.coordinates;
  } catch {
    // Haversine fallback
    const R  = 6371;
    const dR = (dLat - oLat) * Math.PI / 180;
    const lR = (dLng - oLng) * Math.PI / 180;
    const a  = Math.sin(dR / 2) ** 2
             + Math.cos(oLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180)
             * Math.sin(lR / 2) ** 2;
    km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const sorted = [...(frete.faixas || [])].sort((a, b) => a.ate_km - b.ate_km);
  const faixa  = sorted.find(f => km <= f.ate_km) || sorted[sorted.length - 1];

  const kmStr    = `${km.toFixed(1)} km`;
  const precoStr = faixa ? faixa.preco.toFixed(2).replace('.', ',') : '0,00';

  document.getElementById('frete-valor').value                 = precoStr;
  document.getElementById('frete-resultado-km').textContent    = kmStr;
  document.getElementById('frete-resultado-preco').textContent = faixa
    ? `R$ ${precoStr}` : 'Fora das faixas';
  document.getElementById('frete-resultado').style.display     = 'flex';

  recalcularTotal();

  document.getElementById('btn-remover-entrega').style.display = '';

  _renderizarMapa(oLat, oLng, dLat, dLng, rotaCoords);

  if (!faixa) showToast(`${kmStr} — sem faixa configurada para essa distância`);
}

// ── AUTOCOMPLETE DE ENDEREÇO (limitado a 30 km) ──

function _setupFreteAutocomplete() {
  const input  = document.getElementById('frete-endereco');
  const parent = input.parentElement; // .field-group
  parent.style.position = 'relative';

  const dropdown = document.createElement('ul');
  dropdown.className = 'autocomplete-list';
  dropdown.style.display = 'none';
  parent.appendChild(dropdown);

  const buscar = _debounce(async (q) => {
    if (_freteMode !== 'auto') { dropdown.style.display = 'none'; return; }
    if (!q || q.length < 3) { dropdown.style.display = 'none'; return; }
    const origem = frete.origem;
    if (!origem || origem.lat == null) return;

    const bbox = _bbox30km(parseFloat(origem.lat), parseFloat(origem.lng));
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}&format=json&limit=7&viewbox=${bbox}&bounded=1`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data = await resp.json();
      dropdown.innerHTML = '';
      if (!data.length) { dropdown.style.display = 'none'; return; }

      data.forEach(item => {
        const li   = document.createElement('li');
        li.className   = 'autocomplete-item';
        li.textContent = _nomeCurto(item.display_name);
        li.title       = item.display_name;
        li.addEventListener('mousedown', async (e) => {
          e.preventDefault();
          input.value = _nomeCurto(item.display_name);
          dropdown.style.display = 'none';
          const btn = document.querySelector('.btn-calc-frete');
          btn.textContent = '⏳'; btn.disabled = true;
          try   { await _aplicarRota(parseFloat(item.lat), parseFloat(item.lon)); }
          catch { showToast('Erro ao calcular frete'); }
          finally { btn.textContent = '🗺 Calcular'; btn.disabled = false; }
        });
        dropdown.appendChild(li);
      });
      dropdown.style.display = 'block';
    } catch { dropdown.style.display = 'none'; }
  }, 420);

  input.addEventListener('input', () => buscar(input.value.trim()));
  input.addEventListener('blur',  () => setTimeout(() => { dropdown.style.display = 'none'; }, 200));
  input.addEventListener('focus', () => { if (input.value.length >= 3) buscar(input.value.trim()); });
}

// ── CALCULAR FRETE (botão) ──

async function calcularFrete() {
  const endereco = document.getElementById('frete-endereco').value.trim();
  if (!endereco) { showToast('Informe o endereço de entrega!'); return; }

  const origem = frete.origem;
  if (!origem || origem.lat == null) {
    showToast('Origem não configurada — acesse o Editor de Frete!');
    return;
  }

  const btn = document.querySelector('.btn-calc-frete');
  btn.textContent = '⏳';
  btn.disabled    = true;

  try {
    const bbox  = _bbox30km(parseFloat(origem.lat), parseFloat(origem.lng));
    const gResp = await fetch(
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(endereco)}&format=json&limit=1&viewbox=${bbox}&bounded=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    const gData = await gResp.json();
    if (!gData.length) {
      showToast('Nenhum local encontrado no raio de 30 km');
      return;
    }
    await _aplicarRota(parseFloat(gData[0].lat), parseFloat(gData[0].lon));
  } catch {
    showToast('Erro ao calcular frete');
  } finally {
    btn.textContent = '🗺 Calcular';
    btn.disabled    = false;
  }
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

  const freteEndereco = document.getElementById('frete-endereco')?.value.trim() || '';
  const freteKm       = document.getElementById('frete-resultado-km')?.textContent || '';
  const freteValor    = document.getElementById('frete-valor')?.value.trim() || '';

  return { num, nome, valor, forma, troco, pratos, bebidas, freteEndereco, freteKm, freteValor };
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
    const precoStr = p.preco > 0
      ? `<span class="prev-item-preco" style="color:var(--ink)">R$ ${(p.preco * p.quantidade).toFixed(2).replace('.', ',')}</span>`
      : '';
    return `
    <div class="prev-item">
      <div class="prev-item-linha">
        <span class="prev-qty" style="color:var(--ink)">×${p.quantidade}</span>
        <span class="prev-item-nome">${p.nome}</span>
        ${precoStr}
      </div>
      ${p.obs ? `<div class="prev-item-obs">${p.obs}</div>` : ''}
    </div>`;
  }).join('');

  const bebidasHtml = dados.bebidas.map(b => {
    const precoStr = b.preco > 0
      ? `<span class="prev-item-preco" style="color:var(--ink)">R$ ${(b.preco * b.quantidade).toFixed(2).replace('.', ',')}</span>`
      : '';
    return `
    <div class="prev-item">
      <div class="prev-item-linha">
        <span class="prev-qty" style="color:var(--ink)">×${b.quantidade}</span>
        <span class="prev-item-nome">${b.nome}</span>
        ${precoStr}
      </div>
    </div>`;
  }).join('');

  const trocoHtml = dados.troco
    ? `<div class="prev-field"><div class="prev-label">Troco para (R$)</div><div class="prev-value">${dados.troco}</div></div>`
    : '';

  const freteHtml = dados.freteEndereco || dados.freteValor ? `
    <div class="prev-item" style="border-left-color:var(--border); margin-top:10px; background:none;">
      ${dados.freteEndereco ? `<div class="prev-item-linha"><span class="prev-item-nome" style="color:var(--muted); font-size:0.78rem">Endereço: ${dados.freteEndereco}</span></div>` : ''}
      ${dados.freteValor ? `<div class="prev-item-linha" style="margin-top:4px"><span class="prev-item-nome" style="color:var(--muted); font-size:0.78rem">Frete (já incluso no total): R$ ${dados.freteValor}</span></div>` : ''}
    </div>` : '';

  document.getElementById('revisao-preview').innerHTML = `
    <div class="prev-logo">Bar do Júlio</div>
    <div class="prev-tagline">Comanda de Pedido — Delivery</div>
    <div class="prev-row">
      <div class="prev-field"><div class="prev-label">Comanda</div><div class="prev-value">#${dados.num}</div></div>
      <div class="prev-field"><div class="prev-label">Cliente</div><div class="prev-value">${dados.nome}</div></div>
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
    ${freteHtml}
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

  await salvarNoHistorico(dados);

  const params  = new URLSearchParams(window.location.search);
  const agendId = parseInt(params.get('agendId'));
  if (agendId) concluirAgendamento(agendId);

  fecharRevisao();
  await _imprimirComanda(dados);
  setTimeout(() => window.location.reload(), 600);
}

async function _imprimirComanda(dados) {
  const resultado = await window.api.imprimir(dados);
  if (!resultado.ok) {
    alert('Erro ao imprimir: ' + (resultado.erro || 'desconhecido'));
  }
}

// ── SALVAR NO HISTÓRICO ──

async function salvarNoHistorico(dados) {
  const pedido = {
    id:            Date.now(),
    hora:          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    num:           dados.num,
    nome:          dados.nome,
    pratos:        dados.pratos,
    bebidas:       dados.bebidas,
    valor:         dados.valor,
    forma:         dados.forma,
    troco:         dados.troco,
    freteEndereco: dados.freteEndereco || '',
    freteValor:    dados.freteValor    || ''
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
  document.getElementById('frete-endereco').value              = '';
  document.getElementById('frete-valor').value                 = '';
  document.getElementById('frete-resultado').style.display     = 'none';
  document.getElementById('frete-mapa').style.display          = 'none';
  document.getElementById('btn-remover-entrega').style.display = 'none';
  if (_freteMarkers)  { _freteMarkers.forEach(m => _freteMap?.removeLayer(m)); _freteMarkers = []; }
  if (_fretePolyline) { _freteMap?.removeLayer(_fretePolyline); _fretePolyline = null; }
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
  const pedidos = await window.api.lerHistorico(dataHoje());
  let proximo = 1;
  if (pedidos && pedidos.length) {
    const max = pedidos.reduce((m, p) => Math.max(m, parseInt(p.num, 10) || 0), 0);
    proximo = max + 1;
  }
  document.getElementById('num-comanda').value = proximo;
  const hint = document.getElementById('hint-ultima-comanda');
  if (hint) hint.textContent = proximo > 1 ? `última: #${proximo - 1}` : '';
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
  if (!frete.faixas)  frete.faixas  = [];
  if (!frete.origem)  frete.origem  = { lat: null, lng: null };
  _setupFreteAutocomplete();

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

// ── CONFIGURAÇÕES ──

async function abrirConfiguracoes() {
  closeAllPanels();
  const config = await window.api.lerConfig();
  document.getElementById('cfg-impressora-windows').value = config.impressoraNomeWindows || '';
  document.getElementById('config-overlay').style.display = 'flex';
}

function fecharConfiguracoes() {
  document.getElementById('config-overlay').style.display = 'none';
}

async function salvarConfiguracoes() {
  const nome = document.getElementById('cfg-impressora-windows').value.trim();
  await window.api.salvarConfig('impressoraNomeWindows', nome);
  fecharConfiguracoes();
  showToast('Configurações salvas!');
}

