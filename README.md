<div align="center">

```
  🌳  m y L i n e a g e
```

# myLineage

**Explore, preserve e conecte a sua história familiar**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Licença](https://img.shields.io/badge/licença-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## Sobre a aplicação

**myLineage** é uma aplicação web de genealogia que permite gerir registos de pessoas, eventos e relações familiares diretamente no navegador, com persistência local em ficheiros JSON.

### Funcionalidades principais

| Módulo | Descrição |
|---|---|
| **Cadastro** | Criar, editar e remover pessoas com dados pessoais, datas e notas |
| **Eventos** | Registar nascimentos, batismos, casamentos, óbitos, divórcios e adopções |
| **Relações** | Ligar pessoas por filiação, fratria e laços conjugais |
| **Árvore** | Visualização interativa da árvore genealógica em grafo |
| **Indicadores** | Dashboard com gráficos e estatísticas sobre os dados (distribuição por género, nascimentos por década, longevidade, top nomes, etc.) |
| **Importar** | Importação de ficheiros no formato GEDCOM (`.ged`) |
| **Exportar** | Exportação dos dados para GEDCOM |

### Arquitectura

```
Navegador (localStorage)
        │  sincroniza via
        ▼
remote-storage.js  ──────────►  Express server (server.js)
   (shim síncrono)                      │
                                        ▼
                                  JSON-DATA/
                              *.json  (um ficheiro por chave)
```

- `remote-storage.js` é carregado antes de qualquer outro script e popula o `localStorage` sincronamente na abertura da página, interceptando também `setItem` / `removeItem` para persistir as alterações no servidor.
- `server.js` serve os ficheiros estáticos e expõe uma API CRUD em `/api/data/:key`.
- Os dados ficam em `JSON-DATA/` como ficheiros `.json`, facilitando backup e controlo de versão.

---

## Setup

### Pré-requisitos

- [Node.js](https://nodejs.org) v18 ou superior
- npm (incluído com o Node.js)

### Instalação e arranque

```bash
# 1. Clonar o repositório
git clone https://github.com/mbangas/xpto.git
cd xpto

# 2. Instalar dependências
npm install

# 3. Iniciar o servidor
npm start
```

A aplicação fica disponível em **http://localhost:3000**.

> A porta pode ser alterada através da variável de ambiente `PORT`:
> ```bash
> PORT=8080 npm start
> ```

### Estrutura de ficheiros

```
xpto/
├── index.html          # Página de entrada (landing)
├── app.html            # Cadastro de pessoas
├── indicadores.html    # Dashboard de indicadores
├── arvore.html         # Visualização em árvore
├── import.html         # Importação GEDCOM
├── export.html         # Exportação GEDCOM
├── configuracao.html   # Definições
├── style.css           # Design system (dark theme)
├── server.js           # Servidor Express + API CRUD
├── remote-storage.js   # Shim localStorage ↔ servidor
├── package.json
└── JSON-DATA/          # Dados persistidos (gerado automaticamente)
    ├── people%3AmyLineage.json
    ├── events%3AmyLineage.json
    └── relations%3AmyLineage.json
```

### API de dados

O servidor expõe os seguintes endpoints:

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/data` | Lista todas as chaves armazenadas |
| `GET` | `/api/data/:key` | Lê o valor de uma chave |
| `POST` | `/api/data/:key` | Grava / atualiza o valor de uma chave |
| `DELETE` | `/api/data/:key` | Remove uma chave |

Os nomes dos ficheiros em `JSON-DATA/` correspondem a `encodeURIComponent(key) + .json`.

---

## Importação GEDCOM

Para importar uma árvore genealógica existente:

1. Aceda a **Importar** na barra lateral.
2. Selecione um ficheiro `.ged` (GEDCOM 5.5 / 5.5.1).
3. Confirme a importação — os dados são convertidos e guardados automaticamente.

Ficheiros de exemplo estão disponíveis em `GEDCOM/`.