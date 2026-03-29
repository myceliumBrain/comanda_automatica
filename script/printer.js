/* ═══════════════════════════════════════════════════════════
   PRINTER.JS — Módulo de impressão ESC/POS
   Bar do Júlio · Comanda Digital

   Responsabilidades:
   · Receber os dados da comanda
   · Gerar o buffer de comandos ESC/POS
   · Enviar diretamente para a impressora (TCP ou USB)
   · Sem driver, sem diálogo, sem PDF
   ═══════════════════════════════════════════════════════════ */

const net            = require('net');
const fs             = require('fs');
const path           = require('path');
const os             = require('os');
const { execFile }   = require('child_process');

// ── CONSTANTES ESC/POS ──

const ESC = 0x1B;
const GS  = 0x1D;

const INIT         = Buffer.from([ESC, 0x40]);           // Inicializar
const MARGIN_ZERO  = Buffer.from([GS,  0x4C, 0x00, 0x00]); // Margem esquerda = 0
const PRINT_WIDTH  = Buffer.from([GS,  0x57, 0x40, 0x02]); // Área de impressão = 576 dots (72mm)
const ALIGN_LEFT   = Buffer.from([ESC, 0x61, 0x00]);     // Alinhar à esquerda
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);     // Centralizar
const BOLD_ON      = Buffer.from([ESC, 0x45, 0x01]);     // Negrito ativo
const BOLD_OFF     = Buffer.from([ESC, 0x45, 0x00]);     // Negrito desativo
const FONT_NORMAL  = Buffer.from([ESC, 0x21, 0x00]);     // Fonte normal
const FONT_LARGE   = Buffer.from([ESC, 0x21, 0x30]);     // Duplo: largura + altura
const CUT          = Buffer.from([GS,  0x56, 0x00]);     // Corte total do papel
const LF           = Buffer.from([0x0A]);                // Quebra de linha

// Largura em caracteres para papel 80mm (Font A padrão — 48 colunas)
const COLUNAS = 48;

// ── UTILITÁRIOS ──

// Transliteração de acentos → ASCII puro (compatível com qualquer codepage)
function ascii(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '');
}

function txt(s) {
  return Buffer.from(ascii(s), 'ascii');
}

function separador(c = '-') {
  return Buffer.from(c.repeat(COLUNAS), 'ascii');
}

// Linha de duas colunas: texto à esquerda, texto à direita
function linha2col(esq, dir) {
  const maxEsq = COLUNAS - dir.length - 1;
  const l      = esq.length > maxEsq ? esq.slice(0, maxEsq) : esq;
  const pad    = COLUNAS - l.length - dir.length;
  return txt(l + ' '.repeat(Math.max(1, pad)) + dir);
}

// ── GERAÇÃO DO BUFFER ESC/POS ──

function gerarBuffer(dados) {
  const partes = [];
  const a = (...bufs) => bufs.forEach(b => partes.push(b));

  const now = new Date();
  const dt  = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  // ── Cabeçalho ──
  a(INIT, MARGIN_ZERO, PRINT_WIDTH);
  a(ALIGN_CENTER, BOLD_ON, FONT_LARGE);
  a(txt('BAR DO JULIO'), LF);
  a(FONT_NORMAL, txt('Comanda Digital'), LF);
  a(BOLD_OFF, LF);

  a(BOLD_ON, txt(`PEDIDO #${dados.num}`), LF, BOLD_OFF);
  a(txt(`Cliente: ${dados.nome}`), LF);
  a(txt(dt), LF, LF);

  // ── Pratos ──
  if (dados.pratos && dados.pratos.length) {
    a(ALIGN_LEFT, separador(), LF);
    a(BOLD_ON, txt('PRATOS'), BOLD_OFF, LF);
    a(separador(), LF);
    dados.pratos.forEach(item => {
      const preco = item.preco > 0 ? `R$${(item.preco * item.quantidade).toFixed(2)}` : '';
      a(linha2col(`${item.quantidade}x ${item.nome}`, preco), LF);
      if (item.obs) a(txt(`obs: ${item.obs}`), LF);
      a(LF);
    });
    a(LF);
  }

  // ── Bebidas ──
  if (dados.bebidas && dados.bebidas.length) {
    a(ALIGN_LEFT, separador(), LF);
    a(BOLD_ON, txt('BEBIDAS'), BOLD_OFF, LF);
    a(separador(), LF);
    dados.bebidas.forEach(item => {
      const preco = item.preco > 0 ? `R$${(item.preco * item.quantidade).toFixed(2)}` : '';
      a(linha2col(`${item.quantidade}x ${item.nome}`, preco), LF);
    });
    a(LF);
  }

  // ── Total ──
  a(ALIGN_LEFT, separador('='), LF);
  a(BOLD_ON, linha2col('TOTAL', `R$ ${dados.valor}`), LF, BOLD_OFF);
  a(LF);

  // ── Pagamento ──
  a(txt(`Pagamento: ${dados.forma}`), LF);
  if (dados.troco) a(txt(`Troco para: R$ ${dados.troco}`), LF);

  // ── Entrega ──
  if (dados.freteEndereco) {
    a(LF, BOLD_ON, txt('ENTREGA:'), BOLD_OFF, LF);
    a(txt(dados.freteEndereco), LF);
  }
  if (dados.freteValor) a(LF, txt(`frete (ja incluso no total): R$ ${dados.freteValor}`), LF);

  // ── Rodapé ──
  a(LF, ALIGN_CENTER);
  a(separador('-'), LF);
  a(txt('Obrigado pela preferencia!'), LF);
  a(LF, LF, LF);
  a(CUT);

  return Buffer.concat(partes);
}

// ── TRANSPORTE: REDE (TCP/IP) ──

function enviarRede(buffer, ip, porta) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.connect(porta, ip, () => {
      socket.write(buffer, () => {
        socket.destroy();
        resolve();
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Timeout ao conectar com a impressora em ${ip}:${porta}`));
    });

    socket.on('error', reject);
  });
}

// ── TRANSPORTE: USB ──

function enviarUSB(buffer, dispositivo) {
  return new Promise((resolve, reject) => {
    fs.open(dispositivo, 'w', (err, fd) => {
      if (err) return reject(new Error(`Não foi possível abrir ${dispositivo}: ${err.message}`));
      fs.write(fd, buffer, 0, buffer.length, null, (err2) => {
        fs.close(fd, () => {});
        if (err2) reject(err2);
        else resolve();
      });
    });
  });
}

// ── TRANSPORTE: WINDOWS (raw print via Win32 API) ──

function enviarWindows(buffer, impressoraNome) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), 'elgin_print.bin');
    fs.writeFile(tmpFile, buffer, (err) => {
      if (err) return reject(err);

      const ps = `
$bytes = [System.IO.File]::ReadAllBytes('${tmpFile.replace(/\\/g, '\\\\')}')
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public class DOC_INFO_1 {
  public string pDocName;
  public string pOutputFile;
  public string pDataType;
}
public class RawPrint {
  [DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.Drv",EntryPoint="ClosePrinter")]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr h, int level, [In] DOC_INFO_1 di);
  [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="WritePrinter",SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr buf, int cb, out int w);
}
'@
$hPrinter = [IntPtr]::Zero
[RawPrint]::OpenPrinter("${impressoraNome}", [ref]$hPrinter, [IntPtr]::Zero) | Out-Null
if ($hPrinter -eq [IntPtr]::Zero) { throw "Impressora '${impressoraNome}' nao encontrada. Verifique o nome em Configuracoes." }
$di = New-Object DOC_INFO_1
$di.pDocName   = "Comanda"
$di.pOutputFile = $null
$di.pDataType  = "RAW"
[RawPrint]::StartDocPrinter($hPrinter, 1, $di) | Out-Null
[RawPrint]::StartPagePrinter($hPrinter) | Out-Null
$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$w = 0
[RawPrint]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$w) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[RawPrint]::EndPagePrinter($hPrinter) | Out-Null
[RawPrint]::EndDocPrinter($hPrinter) | Out-Null
[RawPrint]::ClosePrinter($hPrinter) | Out-Null
`;

      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], (err2, stdout, stderr) => {
        fs.unlink(tmpFile, () => {});
        if (err2) return reject(new Error(stderr || err2.message));
        resolve();
      });
    });
  });
}

// ── PONTO DE ENTRADA ──

async function imprimir(dados, config) {
  const buffer = gerarBuffer(dados);

  if (process.platform === 'win32') {
    const nome = config.impressoraNomeWindows || 'ELGIN i8';
    await enviarWindows(buffer, nome);
  } else if (config.impressoraTipo === 'usb') {
    const dispositivo = config.impressoraDispositivo || '/dev/usb/lp0';
    await enviarUSB(buffer, dispositivo);
  } else {
    const ip   = config.impressoraIP    || '192.168.1.100';
    const port = config.impressoraPorta || 9100;
    await enviarRede(buffer, ip, port);
  }
}

module.exports = { imprimir };
