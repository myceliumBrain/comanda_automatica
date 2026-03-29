# Comanda Digital — Bar do Júlio

App desktop offline feito com Electron.  
Sem internet. Sem servidor. Os dados ficam em arquivos `.json` na pasta `data/`.

---

## Estrutura do projeto

```
comanda-bar-julio/
├── main.js           ← processo principal Electron (lê/escreve arquivos)
├── preload.js        ← ponte segura Node ↔ renderer (window.api)
├── package.json
│
├── data/             ← criada automaticamente ao iniciar
│   ├── cardapio.json       ← cardápio editado pelo editor
│   ├── config.json         ← número da última comanda etc.
│   └── historico/
│       ├── 2026-03-17.json
│       └── 2026-03-18.json
│
├── style/
│   ├── base.css
│   ├── index.css
│   ├── historico.css
│   └── cardapio.css
│
├── script/
│   ├── utils.js        ← funções compartilhadas + window.api
│   ├── index.js
│   ├── historico.js
│   └── cardapio.js
│
├── index.html
├── historico.html
└── cardapio_editor.html
```

---

## Instalação (primeira vez)

Você precisa ter o **Node.js** instalado: https://nodejs.org  
(versão 18 ou superior recomendada)

```bash
# 1. Entre na pasta do projeto
cd comanda-bar-julio

# 2. Instale as dependências
npm install

# 3. Inicie o app
npm start
```

A pasta `data/` é criada automaticamente na primeira execução.

---

## Uso diário

```bash
npm start
```

Só isso. O app abre como janela desktop, sem navegador, sem internet.

---

## Dados salvos

| Arquivo | Conteúdo |
|---|---|
| `data/cardapio.json` | Pratos e bebidas com disponibilidade por dia |
| `data/config.json` | Número da última comanda e outras configurações |
| `data/historico/YYYY-MM-DD.json` | Pedidos do dia, um arquivo por dia |

Exemplo de `data/historico/2026-03-17.json`:
```json
[
  {
    "id": 1710698400000,
    "hora": "12:34",
    "num": "42",
    "nome": "João Silva",
    "pratos": [{ "nome": "Frango ao molho", "obs": "sem cebola" }],
    "bebidas": [{ "nome": "Coca-Cola 2L" }],
    "valor": "45,90",
    "forma": "Pix",
    "troco": ""
  }
]
```

Esses arquivos podem ser abertos no Excel, copiados, enviados por WhatsApp, etc.

---

## Gerar instalador (.exe / .dmg)

```bash
npm run build
```

O instalador é gerado na pasta `dist/`.  
**Windows**: `dist/Comanda Bar do Julio Setup 1.0.0.exe`  
**macOS**: `dist/Comanda Bar do Julio-1.0.0.dmg`

> Para buildar no Windows, rode no Windows.  
> Para buildar no macOS, rode no macOS.

---

## Backup dos dados

Copie a pasta `data/` para um pendrive ou nuvem quando quiser fazer backup.  
Para restaurar, basta colocar a pasta de volta no lugar.