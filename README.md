<div align="center">

```
  🌳  m y L i n e a g e
```

# myLineage

**Explore, preserve e conecte a sua história familiar**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![GEDCOM](https://img.shields.io/badge/GEDCOM-7.0-4c8bf5?style=flat-square)](https://gedcom.io)
[![Licença](https://img.shields.io/badge/licença-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## Sobre a aplicação

**myLineage** é uma aplicação web de genealogia compatível com **GEDCOM 7** que permite gerir indivíduos, famílias, fontes, repositórios, multimédia e notas, com persistência local em ficheiros JSON servidos por uma API REST.

### Funcionalidades principais

| Módulo | Página | Descrição |
|---|---|---|
| **Início** | `index.html` | Dashboard de boas-vindas com atalhos para todos os módulos |
| **Cadastro** | `app.html` | Criar, editar e remover indivíduos (nomes, sexo, eventos, atributos, fontes, notas) |
| **Árvore** | `arvore.html` | Visualização interativa da árvore genealógica (Topola + family-chart) |
| **Indicadores** | `indicadores.html` | Dashboard com estatísticas: género, nascimentos, óbitos, casamentos, fontes, multimédia |
| **GEDCOM** | `gedcom.html` | Importação e exportação de ficheiros `.ged` (GEDCOM 7.0) |
| **Álbum** | `album.html` | Galeria de multimédia associada aos registos OBJE |
| **Documentos** | `documentos.html` | Biblioteca de documentos com pré-visualização de PDF, imagem, vídeo e áudio |
| **Histórico** | `historico.html` | Registo de auditoria de todas as alterações (criações, edições, eliminações) |
| **Validação** | `validacao.html` | Análise de consistência e qualidade dos dados GEDCOM |
| **Definições** | `configuracao.html` | Configurações gerais da aplicação |
| **APIs** | `apis.html` | Referência interativa de todos os endpoints REST |

---

### Arquitectura

```
Browser (HTML + JS)
        │  fetch REST
        ▼
server.js  (Express)
        │
        ├─ /api/individuals    ──► JSON-DATA/individuals.json
        ├─ /api/families       ──► JSON-DATA/families.json
        ├─ /api/sources        ──► JSON-DATA/sources.json
        ├─ /api/repositories   ──► JSON-DATA/repositories.json
        ├─ /api/multimedia     ──► JSON-DATA/multimedia.json
        ├─ /api/notes          ──► JSON-DATA/notes.json
        ├─ /api/submitters     ──► JSON-DATA/submitters.json
        ├─ /api/settings       ──► JSON-DATA/settings.json
        ├─ /api/history        ──► JSON-DATA/history.json
        ├─ /api/gedcom/import  ──► parser → bulk write
        └─ /api/gedcom/export  ──► serializer → .ged download
```

- `remote-storage.js` é carregado em todas as páginas e inicializa o objeto global `window.GedcomDB`, que encapsula todos os acessos à API REST.
- `history-logger.js` envolve as mutações do `GedcomDB` e regista cada criação, edição e eliminação em `/api/history` (máximo 500 entradas).
- `server.js` serve os ficheiros estáticos e expõe a API CRUD GEDCOM 7, com soft-delete (`deletedAt`) em todos os registos de entidade.
- Os dados ficam em `JSON-DATA/` como ficheiros `.json`, facilitando backup e controlo de versão.
- As visualizações de árvore usam os bundles pré-compilados `topola-bundle.js` (Topola) e `family-chart-bundle.js` (family-chart), gerados por `esbuild`.

---

## Setup

### 🚀 Instalação automática (recomendado) — Docker em LXC Proxmox

Para instalar o **myLineage** num LXC em Proxmox (Debian 12 ou Ubuntu 22.04+) com um único comando, use o instalador automático disponível na pasta [`setup/`](setup/):

```bash
# Descarregar e executar o instalador
curl -fsSL https://raw.githubusercontent.com/mbangas/myLineage/main/setup/install.sh -o install.sh
sudo bash install.sh
```

O instalador apresenta um **ecrã interactivo azul** que guia o utilizador em cada passo:
- Actualiza o sistema, instala Docker CE e Portainer
- Pergunta os caminhos para três volumes (fotografias, documentos, GEDCOM)
- Descarrega o código, cria o `Dockerfile` e `docker-compose.yml`, faz o build e inicia tudo
- Apresenta os URLs de acesso e comandos úteis no final

📖 **Consulte [setup/INSTALL.md](setup/INSTALL.md)** para instruções detalhadas passo a passo, incluindo como preparar o LXC no Proxmox, o que fazer na primeira visita ao Portainer e como fazer backups.

---

### Instalação manual (desenvolvimento local)

#### Pré-requisitos

- [Node.js](https://nodejs.org) v18 ou superior
- npm (incluído com o Node.js)

#### Arranque

```bash
# 1. Clonar o repositório
git clone https://github.com/mbangas/myLineage.git
cd myLineage

# 2. Instalar dependências
npm install

# 3. Compilar os bundles e iniciar o servidor
npm start
```

O `npm start` executa primeiro `npm run build:all` (esbuild) antes de lançar o servidor.

A aplicação fica disponível em **http://localhost:3000**.

> A porta pode ser alterada através da variável de ambiente `PORT`:
> ```bash
> PORT=8080 npm start
> ```

---

### Estrutura de ficheiros

```
myLineage/
├── index.html             # Início — dashboard de boas-vindas
├── app.html               # Cadastro de indivíduos
├── arvore.html            # Árvore genealógica interativa
├── indicadores.html       # Indicadores e estatísticas
├── gedcom.html            # Importação e exportação GEDCOM 7
├── album.html             # Galeria de multimédia (OBJE)
├── documentos.html        # Biblioteca de documentos
├── historico.html         # Histórico de auditoria
├── validacao.html         # Validação e qualidade dos dados
├── configuracao.html      # Definições da aplicação
├── apis.html              # Referência de APIs
├── server.js              # Servidor Express + API GEDCOM 7
├── remote-storage.js      # Inicialização do GedcomDB global
├── history-logger.js      # Logger de auditoria de mutações
├── topola-entry.js        # Entry-point para bundle Topola
├── topola-bundle.js       # Bundle pré-compilado (gerado)
├── family-chart-entry.js  # Entry-point para bundle family-chart
├── family-chart-bundle.js # Bundle pré-compilado (gerado)
├── package.json
├── css/
│   ├── style.css          # Design system (dark theme)
│   ├── family-chart.css
│   └── sys-dates.css
└── JSON-DATA/             # Dados persistidos (gerado automaticamente)
    ├── individuals.json
    ├── families.json
    ├── sources.json
    ├── repositories.json
    ├── multimedia.json
    ├── notes.json
    ├── settings.json
    └── history.json
```

---

### API de dados

O servidor expõe uma API REST GEDCOM 7 com CRUD completo para cada entidade:

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/:entity` | Lista todos os registos activos (sem `deletedAt`) |
| `GET` | `/api/:entity?includeDeleted=true` | Lista incluindo registos eliminados (soft-delete) |
| `GET` | `/api/:entity/:id` | Lê um registo pelo ID |
| `POST` | `/api/:entity` | Cria um novo registo (ID auto-gerado se omitido) |
| `PUT` | `/api/:entity/:id` | Actualiza um registo existente |
| `DELETE` | `/api/:entity/:id` | Soft-delete (preenche `deletedAt`) |
| `POST` | `/api/bulk-replace` | Substitui colecções inteiras de uma vez |
| `GET` | `/api/header` | Lê o cabeçalho GEDCOM (versão, charset, etc.) |
| `PUT` | `/api/header` | Actualiza o cabeçalho GEDCOM |
| `GET` | `/api/settings` | Lê as definições da aplicação |
| `PUT` | `/api/settings` | Actualiza as definições da aplicação |
| `GET` | `/api/history` | Lista o histórico de auditoria (máx. 500 entradas) |
| `POST` | `/api/history` | Adiciona entradas ao histórico |
| `DELETE` | `/api/history` | Limpa o histórico |
| `GET` | `/api/stats` | Estatísticas agregadas (totais, eventos, género) |
| `GET` | `/api/gedcom/export` | Exporta todos os dados em formato GEDCOM 7 (texto) |
| `GET` | `/api/gedcom/export?format=file` | Exporta como ficheiro `.ged` para download |
| `POST` | `/api/gedcom/import` | Importa e processa um ficheiro GEDCOM (texto) |
| `GET` | `/api/topola-json` | Dados formatados para renderização Topola |

#### Entidades disponíveis (`/:entity`)

| Entidade | Prefixo de ID | Ficheiro JSON | Tag GEDCOM |
|---|---|---|---|
| `individuals` | `I` | `individuals.json` | `INDI` |
| `families` | `F` | `families.json` | `FAM` |
| `sources` | `S` | `sources.json` | `SOUR` |
| `repositories` | `R` | `repositories.json` | `REPO` |
| `multimedia` | `M` | `multimedia.json` | `OBJE` |
| `notes` | `N` | `notes.json` | `NOTE` |
| `submitters` | `U` | `submitters.json` | `SUBM` |

---

## Árvore Genealógica

A página `arvore.html` suporta dois motores de visualização:

- **Topola** — diagrama de descendência / ascendência em SVG, navegável por pessoa.
- **family-chart** — grafo de família completo.

Os bundles são compilados com `esbuild` a partir dos entry-points:

```bash
npm run build:topola        # compila topola-bundle.js
npm run build:familychart   # compila family-chart-bundle.js
npm run build:all           # compila ambos
```

## Histórico de Auditoria

O `history-logger.js` envolve automaticamente os métodos de mutação do `GedcomDB` e regista cada operação com:

- Tipo de entidade e ID
- Acção (`create`, `update`, `delete`)
- Timestamp ISO 8601

O log é consultável em **Histórico** e limitado a 500 entradas (FIFO).

## Validação GEDCOM

A página **Validação** analisa os dados carregados e reporta:

- Indivíduos sem nome ou sem data de nascimento
- Famílias sem cônjuge ou sem filhos
- Referências cruzadas inválidas (FAMC / FAMS inconsistentes)
- KPIs de qualidade com indicadores visuais

## Importação / Exportação GEDCOM

1. Aceda a **GEDCOM** na barra lateral.
2. **Importar**: cole ou carregue um ficheiro `.ged` (GEDCOM 5.5, 5.5.1 ou 7.0) e confirme — os registos `INDI` e `FAM` são convertidos e substituem os dados actuais.
3. **Exportar**: clique em **Exportar .ged** — o servidor serializa todos os dados em GEDCOM 7.0 e devolve o ficheiro para download.

---

## Testes

A suite de testes cobre CRUD de todas as entidades, conformidade GEDCOM 7, importação/exportação e fluxos de integração multi-entidade.

```bash
npm install          # instalar dependências (inclui jest e supertest)
npm test             # testes unitários + integração
npm run test:unit    # só unitários
npm run test:integration  # só integração
npm run test:coverage    # com relatório de cobertura
```

Consulte **[tests/README.md](tests/README.md)** para a organização completa das pastas, detalhes de cada ficheiro e instruções para automatização via GitHub Actions.
