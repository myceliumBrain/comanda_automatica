/* ═══════════════════════════════════════════════════════════
   PRELOAD.JS — Ponte segura entre Node.js e o renderer
   Bar do Júlio · Comanda Digital

   Expõe window.api ao renderer com apenas os métodos
   necessários — o renderer nunca toca no Node diretamente.
   ═══════════════════════════════════════════════════════════ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  // ── CARDÁPIO ──

  /** Lê data/cardapio.json. Retorna null se ainda não existir. */
  lerCardapio: () =>
    ipcRenderer.invoke('cardapio:ler'),

  /** Salva o cardápio inteiro em data/cardapio.json. */
  salvarCardapio: (cardapio) =>
    ipcRenderer.invoke('cardapio:salvar', cardapio),

  // ── FRETE ──

  /** Lê data/frete.json. */
  lerFrete: () =>
    ipcRenderer.invoke('frete:ler'),

  /** Salva a tabela de frete completa. */
  salvarFrete: (frete) =>
    ipcRenderer.invoke('frete:salvar', frete),

  // ── HISTÓRICO ──

  /** Lê data/historico/YYYY-MM-DD.json. Retorna [] se não existir. */
  lerHistorico: (data) =>
    ipcRenderer.invoke('historico:ler', data),

  /** Acrescenta um pedido ao arquivo do dia. */
  salvarPedido: (data, pedido) =>
    ipcRenderer.invoke('historico:salvarPedido', data, pedido),

  /** Apaga todos os pedidos de um dia (sobrescreve com []). */
  limparHistorico: (data) =>
    ipcRenderer.invoke('historico:limpar', data),

  /** Alterna o campo cancelado de um pedido pelo id. */
  toggleCanceladoPedido: (data, id) =>
    ipcRenderer.invoke('historico:toggleCancelado', data, id),

  /** Lista todas as datas com histórico salvo, mais recente primeiro. */
  listarDatasHistorico: () =>
    ipcRenderer.invoke('historico:listarDatas'),

  // ── CONFIG ──

  /** Lê data/config.json inteiro. */
  lerConfig: () =>
    ipcRenderer.invoke('config:ler'),

  /** Salva um par chave/valor em data/config.json. */
  salvarConfig: (chave, valor) =>
    ipcRenderer.invoke('config:salvar', chave, valor),

});