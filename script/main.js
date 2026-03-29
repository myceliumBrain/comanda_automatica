/* ═══════════════════════════════════════════════════════════
   MAIN.JS — Processo principal do Electron
   Bar do Júlio · Comanda Digital

   Responsabilidades:
   · Criar a janela do app
   · Gerenciar a pasta data/ (histórico, cardápio, config)
   · Responder a todas as chamadas IPC vindas do renderer
   ═══════════════════════════════════════════════════════════ */

const { app, BrowserWindow, ipcMain } = require('electron');
const path    = require('path');
const fs      = require('fs');
const printer = require('./printer');

// Lida com eventos de instalação/atualização do Squirrel (Windows)
if (require('electron-squirrel-startup')) app.quit();

// ── PASTA DE DADOS ──
// Em desenvolvimento : <projeto>/data/
// Em produção (build): AppData/Roaming/comanda-bar-julio/data/  (persiste entre atualizações)
const DATA_DIR      = app.isPackaged
  ? path.join(app.getPath('userData'), 'data')
  : path.join(__dirname, '..', 'data');

const HIST_DIR      = path.join(DATA_DIR, 'historico');
const CARDAPIO_PATH = path.join(DATA_DIR, 'cardapio.json');
const FRETE_PATH    = path.join(DATA_DIR, 'frete.json');
const CONFIG_PATH   = path.join(DATA_DIR, 'config.json');

// Garante pastas e copia arquivos padrão do pacote caso ainda não existam
function garantirPastas() {
  [DATA_DIR, HIST_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  if (!app.isPackaged) return;

  // Migração v1.0.7→v1.0.8: copia dados da localização antiga (resources/data)
  // para a nova (AppData/Roaming), preservando histórico existente
  const legado = path.join(process.resourcesPath, 'data');
  if (fs.existsSync(legado)) {
    for (const arquivo of ['cardapio.json', 'frete.json', 'config.json']) {
      const origem  = path.join(legado, arquivo);
      const destino = path.join(DATA_DIR, arquivo);
      if (fs.existsSync(origem) && !fs.existsSync(destino)) {
        fs.copyFileSync(origem, destino);
      }
    }
    // Migra arquivos de histórico
    const legadoHist = path.join(legado, 'historico');
    if (fs.existsSync(legadoHist)) {
      fs.readdirSync(legadoHist).forEach(arquivo => {
        const origem  = path.join(legadoHist, arquivo);
        const destino = path.join(HIST_DIR, arquivo);
        if (!fs.existsSync(destino)) fs.copyFileSync(origem, destino);
      });
    }
  }

  // Copia defaults do pacote para arquivos que ainda não existam
  for (const arquivo of ['cardapio.json', 'frete.json', 'config.json']) {
    const destino = path.join(DATA_DIR, arquivo);
    const origem  = path.join(legado, arquivo);
    if (!fs.existsSync(destino) && fs.existsSync(origem)) {
      fs.copyFileSync(origem, destino);
    }
  }
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

  win.loadFile(path.join(__dirname, '..', 'index.html'));

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

// ── IMPRESSÃO TÉRMICA (ESC/POS) ──

ipcMain.handle('comanda:imprimir', async (_, dados) => {
  const config = lerJSON(CONFIG_PATH, {});
  try {
    await printer.imprimir(dados, config);
    return { ok: true };
  } catch (err) {
    console.error('Erro ao imprimir:', err);
    return { ok: false, erro: err.message };
  }
});

// ── CICLO DE VIDA ──

// Desabilita aceleração de hardware no Linux (evita erros de GBM/DRM no stderr)
app.disableHardwareAcceleration();

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
