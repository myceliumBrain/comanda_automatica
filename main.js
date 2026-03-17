/* ═══════════════════════════════════════════════════════════
   MAIN.JS — Processo principal do Electron
   Bar do Júlio · Comanda Digital

   Responsabilidades:
   · Criar a janela do app
   · Gerenciar a pasta data/ (histórico, cardápio, config)
   · Responder a todas as chamadas IPC vindas do renderer
   ═══════════════════════════════════════════════════════════ */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── PASTA DE DADOS ──
// Em desenvolvimento : <projeto>/data/
// Em produção (build): pasta do executável + /data/
const DATA_DIR      = app.isPackaged
  ? path.join(process.resourcesPath, 'data')
  : path.join(__dirname, 'data');

const HIST_DIR      = path.join(DATA_DIR, 'historico');
const CARDAPIO_PATH = path.join(DATA_DIR, 'cardapio.json');
const FRETE_PATH    = path.join(DATA_DIR, 'frete.json');
const CONFIG_PATH   = path.join(DATA_DIR, 'config.json');

// Garante que as pastas existem ao iniciar
function garantirPastas() {
  [DATA_DIR, HIST_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ── LEITURA / ESCRITA GENÉRICA ──

function lerJSON(caminho, padrao = null) {
  try {
    if (fs.existsSync(caminho)) {
      return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
    }
  } catch (e) {
    console.error(`Erro ao ler ${caminho}:`, e);
  }
  return padrao;
}

function salvarJSON(caminho, dados) {
  try {
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`Erro ao salvar ${caminho}:`, e);
    return false;
  }
}

// ── JANELA PRINCIPAL ──

function criarJanela() {
  const win = new BrowserWindow({
    width:     900,
    height:    780,
    minWidth:  600,
    minHeight: 500,
    title: 'Comanda — Bar do Júlio',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer não acessa Node diretamente
      nodeIntegration:  false,
    }
  });

  win.loadFile('index.html');

  // Descomente para abrir DevTools durante desenvolvimento:
  // win.webContents.openDevTools();
}

// ── HANDLERS IPC ──
// Cada handle responde a um canal chamado pelo renderer via window.api

// ── CARDÁPIO ──

ipcMain.handle('cardapio:ler', () => {
  // Retorna null se o arquivo ainda não existe (renderer usa padrão embutido)
  return lerJSON(CARDAPIO_PATH, null);
});

ipcMain.handle('cardapio:salvar', (_, cardapio) => {
  return salvarJSON(CARDAPIO_PATH, cardapio);
});

// ── FRETE ──

ipcMain.handle('frete:ler', () => {
  return lerJSON(FRETE_PATH, { bairros: [] });
});

ipcMain.handle('frete:salvar', (_, frete) => {
  return salvarJSON(FRETE_PATH, frete);
});

// ── HISTÓRICO ──

ipcMain.handle('historico:ler', (_, data) => {
  const caminho = path.join(HIST_DIR, `${data}.json`);
  return lerJSON(caminho, []); // [] = nenhum pedido nesse dia
});

ipcMain.handle('historico:salvarPedido', (_, data, pedido) => {
  const caminho = path.join(HIST_DIR, `${data}.json`);
  const pedidos = lerJSON(caminho, []);
  pedidos.push(pedido);
  return salvarJSON(caminho, pedidos);
});

ipcMain.handle('historico:limpar', (_, data) => {
  const caminho = path.join(HIST_DIR, `${data}.json`);
  return salvarJSON(caminho, []);
});

ipcMain.handle('historico:toggleCancelado', (_, data, id) => {
  const caminho = path.join(HIST_DIR, `${data}.json`);
  const pedidos = lerJSON(caminho, []);
  const pedido  = pedidos.find(p => p.id === id);
  if (!pedido) return false;
  pedido.cancelado = !pedido.cancelado;
  return salvarJSON(caminho, pedidos);
});

ipcMain.handle('historico:listarDatas', () => {
  // Retorna todas as datas que têm arquivo — útil para calendário/navegação
  try {
    return fs.readdirSync(HIST_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse(); // mais recente primeiro
  } catch (e) {
    return [];
  }
});

// ── CONFIG (última comanda, preferências futuras) ──

ipcMain.handle('config:ler', () => {
  return lerJSON(CONFIG_PATH, {});
});

ipcMain.handle('config:salvar', (_, chave, valor) => {
  const config  = lerJSON(CONFIG_PATH, {});
  config[chave] = valor;
  return salvarJSON(CONFIG_PATH, config);
});

// ── CICLO DE VIDA ──

app.whenReady().then(() => {
  garantirPastas();
  criarJanela();

  app.on('activate', () => {
    // macOS: recria janela ao clicar no ícone do dock sem janelas abertas
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});