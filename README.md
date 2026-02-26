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

**myLineage** é uma aplicação web de genealogia que permite gerir registos de pessoas, eventos, relações familiares, fotografias e documentos, diretamente no navegador, com persistência local em ficheiros JSON.

### Funcionalidades principais

| Módulo | Descrição |
|---|---|
| **Cadastro** | Criar, editar e remover pessoas com dados pessoais, datas e notas |
| **Eventos** | Registar nascimentos, batismos, casamentos, óbitos, divórcios e adopções |
| **Relações** | Ligar pessoas por filiação, fratria e laços conjugais |
| **Árvore** | Visualização interativa da árvore genealógica em grafo |
| **Indicadores** | Dashboard com gráficos e estatísticas (distribuição por género, nascimentos por década, longevidade, top nomes, etc.) |
| **GEDCOM** | Importação e exportação de ficheiros `.ged` (GEDCOM 5.5 / 5.5.1) |
| **Álbum** | Galeria de thumbnails de todas as fotografias da Biblioteca de Fotos; modal com pré-visualização e informação da foto |
| **Documentos** | Galeria de documentos da Biblioteca de Documentos; pré-visualização de PDF, imagem, texto, vídeo, áudio e download para outros tipos |
| **Detalhe da Pessoa** | Vista completa de uma pessoa: dados, eventos, relações, fotos (com upload, identificação de pessoas por região e notas) |
| **Definições** | Configuração da Biblioteca de Fotos, Biblioteca de Documentos e Pessoa em Foco |

---

### Arquitectura

```
Navegador (localStorage + IndexedDB)
        │  sincroniza via
        ▼
remote-storage.js  ──────────►  Express server (server.js)
   (shim síncrono)                      │
                                        ▼
                                  JSON-DATA/
                              *.json  (um ficheiro por chave)

Biblioteca de Fotos / Documentos
  → acedida diretamente pelo browser via File System Access API
  → handle de directório persistido em IndexedDB (myLineage-db)
```

- `remote-storage.js` é carregado antes de qualquer outro script e sincroniza o `localStorage` com o servidor ao arrancar, interceptando também `setItem` / `removeItem` para persistir alterações.
- `server.js` serve os ficheiros estáticos e expõe uma API CRUD em `/api/data/:key`.
- Os dados ficam em `JSON-DATA/` como ficheiros `.json`, facilitando backup e controlo de versão.
- As pastas de fotos e documentos são acedidas localmente via **File System Access API** — o browser pede permissão uma vez e o handle fica guardado em IndexedDB.

---

## Setup

### Pré-requisitos

- [Node.js](https://nodejs.org) v18 ou superior
- npm (incluído com o Node.js)
- Browser com suporte a **File System Access API** (Chrome / Edge ≥ 86) para as bibliotecas de fotos e documentos

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

---

### Estrutura de ficheiros

```
xpto/
├── index.html          # Página de entrada (landing)
├── app.html            # Cadastro de pessoas
├── indicadores.html    # Dashboard de indicadores
├── arvore.html         # Visualização em árvore genealógica
├── gedcom.html         # Importação e exportação GEDCOM
├── album.html          # Álbum de fotografias (Biblioteca de Fotos)
├── documentos.html     # Biblioteca de Documentos
├── pessoa-detalhe.html # Detalhe de uma pessoa (eventos, relações, fotos)
├── configuracao.html   # Definições (bibliotecas, pessoa em foco)
├── apis.html           # Referência das APIs e chaves de dados
├── landing.html        # Página pública de apresentação
├── style.css           # Design system (dark theme)
├── landing.css         # Estilos da landing page
├── sys-dates.css       # Estilos de datas do sistema
├── server.js           # Servidor Express + API CRUD
├── remote-storage.js   # Shim localStorage ↔ servidor
├── package.json
├── GEDCOM/             # Ficheiros GEDCOM de exemplo
│   └── GEDCOM (1).ged
└── JSON-DATA/          # Dados persistidos (gerado automaticamente)
    ├── people%3AmyLineage.json
    ├── events%3AmyLineage.json
    ├── relations%3AmyLineage.json
    ├── photos%3AmyLineage.json
    ├── photoRelations%3AmyLineage.json
    ├── photoBase%3AmyLineage.json
    ├── docBase%3AmyLineage.json
    └── focusedPerson%3AmyLineage.json
```

---

### API de dados

O servidor expõe os seguintes endpoints REST:

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/data` | Lista todas as chaves armazenadas |
| `GET` | `/api/data/:key` | Lê o valor de uma chave |
| `POST` | `/api/data/:key` | Grava / atualiza o valor de uma chave |
| `DELETE` | `/api/data/:key` | Remove uma chave |

Os nomes dos ficheiros em `JSON-DATA/` correspondem a `encodeURIComponent(key) + .json`.

### Chaves de dados principais

| Chave localStorage | Conteúdo |
|---|---|
| `people:myLineage` | Array de pessoas (id, nome, género, notas, datas) |
| `events:myLineage` | Array de eventos por pessoa (tipo, data, local, notas) |
| `relations:myLineage` | Array de relações entre pessoas (from, to, type) |
| `photos:myLineage` | Array de fotos com metadados, notas e identificações por região (tags com bbox) |
| `photoRelations:myLineage` | Mapa `personId → [photoId, …]` |
| `photoBase:myLineage` | Configuração da pasta de fotos (nome, contagem, data) |
| `docBase:myLineage` | Configuração da pasta de documentos (nome, contagem, data) |
| `focusedPerson:myLineage` | Pessoa em foco atual (id, nome, data de definição) |

### IndexedDB — handles de directório

Os handles de File System Access API ficam em `indexedDB` (`myLineage-db`, object store `handles`):

| Chave | Descrição |
|---|---|
| `photoBaseHandle` | `FileSystemDirectoryHandle` da pasta de fotos |
| `docBaseHandle` | `FileSystemDirectoryHandle` da pasta de documentos |

---

## Álbum de Fotografias

1. Abra **Definições** e selecione a pasta de fotografias em **Biblioteca de Fotos**.
2. Navegue para **Álbum** — todas as imagens da pasta são apresentadas como thumbnails.
3. As fotos com pessoas associadas mostram chips com os nomes.
4. Clique numa foto para abrir o modal com a imagem e os metadados.

Para associar fotos a pessoas, use a página **Detalhe da Pessoa** → secção Fotos.

## Documentos

1. Abra **Definições** e selecione a pasta em **Biblioteca de Documentos**.
2. Navegue para **Documentos** — todos os ficheiros são listados como thumbnails com ícone por tipo.
3. Filtre por tipo (PDF, Word, Excel, imagem, texto, vídeo, …) usando os pills de filtro.
4. Clique num documento para abrir o visualizador:
   - **PDF** — incorporado no browser
   - **Imagens** — visualizador integrado
   - **Texto / CSV / JSON / código** — conteúdo em texto simples
   - **Vídeo / Áudio** — player nativo
   - **Outros** — botão de download

## Importação GEDCOM

1. Aceda a **GEDCOM** na barra lateral.
2. Selecione um ficheiro `.ged` (GEDCOM 5.5 / 5.5.1).
3. Confirme a importação — os dados são convertidos e guardados automaticamente.

Ficheiros de exemplo estão disponíveis em `GEDCOM/`.
