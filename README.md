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

**myLineage** é uma plataforma web SaaS multi-tenant de genealogia compatível com **GEDCOM 7** que permite gerir indivíduos, famílias, fontes, repositórios, multimédia e notas, com PostgreSQL como base de dados e suporte para múltiplas árvores com 4 níveis de acesso.

### Funcionalidades principais

| Módulo | Página | Descrição |
|---|---|---|
| **Landing** | `landing.html` | As minhas árvores, árvores partilhadas, convites pendentes |
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
| **Def. Árvore** | `tree-settings.html` | Gestão de membros, convites e eliminação da árvore |
| **Admin** | `admin.html` | Dashboard de administração (utilizadores, árvores, login audit) |
| **APIs** | `apis.html` | Referência interativa de todos os endpoints REST |

### Autenticação & Acesso

- **Email + password** com JWT (access + refresh tokens)
- **TOTP 2FA** (obrigatório para admin, opcional para outros utilizadores)
- **4 níveis de acesso**: Owner, Writer, Reader, Admin
- **Convites por email** (SMTP genérico) com link de aceitação
- **Notificações in-app** com polling (sino no header)

---

### Arquitectura

```
Browser (HTML + JS)
        │  fetch REST (JWT Bearer)
        ▼
server.js  (Express)
        │
        ├─ /api/auth/*                 → Registo, Login, TOTP, Refresh, Profile
        ├─ /api/trees/*                → Gestão de árvores + membros
        ├─ /api/trees/:treeId/*        → CRUD genealógico (tree-scoped)
        │   ├─ /individuals            ──┐
        │   ├─ /families               ──┤
        │   ├─ /sources                ──┤
        │   ├─ /multimedia             ──┤ genealogy_records (JSONB)
        │   ├─ /notes                  ──┤
        │   └─ /submitters             ──┘
        ├─ /api/trees/:treeId/invitations → Convites por email
        ├─ /api/invitations/*          → Convites do utilizador
        ├─ /api/notifications/*        → Notificações in-app
        ├─ /api/admin/*                → Admin dashboard (stats, users, trees, logins)
        └─ /api/* (legacy)             → Backward-compat → LEGACY_TREE_ID
        │
        ▼
   PostgreSQL 16  (genealogy_records, users, trees, tree_memberships, ...)
```

- **Multi-tenant**: cada árvore é um tenant isolado, com dados separados na tabela `genealogy_records` (tree_id + collection + entity_id + data JSONB)
- **Dual-mode**: quando `DATABASE_URL` está definido, usa PostgreSQL; caso contrário, cai para ficheiros JSON (desenvolvimento local sem Docker)
- `remote-storage.js` é carregado em todas as páginas e inicializa o objeto global `window.GedcomDB`, que encapsula todos os acessos à API REST tree-scoped
- `tree-switcher.js` injecta o seletor de árvore no topbar de todas as páginas
- `notifications.js` injecta o sino de notificações com polling a cada 60s
- `auth.js` gere JWT (access + refresh tokens) com renovação automática
- `history-logger.js` envolve as mutações do `GedcomDB` e regista cada criação, edição e eliminação

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
- [Docker](https://www.docker.com/) + Docker Compose (para PostgreSQL)

#### Arranque com Docker (recomendado)

```bash
# 1. Clonar o repositório
git clone https://github.com/mbangas/myLineage.git
cd myLineage

# 2. Iniciar com Docker Compose (PostgreSQL + app)
docker compose up -d --build
```

A aplicação fica disponível em **http://localhost:3000** com PostgreSQL na porta 5433.

#### Variáveis de ambiente (docker-compose.yml)

| Variável | Descrição | Default |
|---|---|---|
| `DATABASE_URL` | URL de ligação ao PostgreSQL | `postgres://mylineage:mylineage_dev@postgres:5432/mylineage` |
| `JWT_SECRET` | Segredo para assinatura de JWT | `change_me_in_production` |
| `ADMIN_EMAIL` | Email do administrador (seeded no startup) | `admin@mylineage.local` |
| `ADMIN_PASSWORD` | Password do administrador | `Admin1234!` |
| `APP_URL` | URL base da aplicação | `http://localhost:3000` |
| `SMTP_HOST` | Servidor SMTP para envio de convites | *(vazio)* |
| `SMTP_PORT` | Porta SMTP | `587` |
| `SMTP_USER` | Utilizador SMTP | *(vazio)* |
| `SMTP_PASS` | Password SMTP | *(vazio)* |
| `SMTP_FROM` | Remetente dos emails | `myLineage <noreply@mylineage.local>` |

#### Arranque sem Docker (dev mode, ficheiros JSON)

```bash
# 1. Instalar dependências
npm install

# 2. Definir JWT_SECRET e iniciar
JWT_SECRET=my-secret npm start
```

Sem `DATABASE_URL`, a app usa ficheiros JSON em `JSON-DATA/` (modo legado, single-tenant).

---

### Estrutura de ficheiros

```
myLineage/
├── index.html             # Início — dashboard de boas-vindas
├── landing.html           # Landing page — gestão de árvores
├── login.html             # Login (email + password)
├── register.html          # Registo de novo utilizador
├── admin.html             # Dashboard de administração
├── tree-settings.html     # Definições da árvore (membros, convites)
├── invite.html            # Aceitação de convites
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
├── server.js              # Servidor Express + API
├── remote-storage.js      # GedcomDB global (tree-scoped)
├── auth.js                # Gestão JWT client-side
├── tree-switcher.js       # Seletor de árvore auto-injetado
├── notifications.js       # Sino de notificações auto-injetado
├── history-logger.js      # Logger de auditoria de mutações
├── edit-person-drawer.js  # Painel lateral de edição de pessoa
├── package.json
├── docker-compose.yml     # PostgreSQL + app
├── Dockerfile             # Build multi-stage
├── lib/
│   ├── db.js              # Pool PostgreSQL + helpers
│   ├── crud-helpers.js    # CRUD dual-mode (PG + JSON fallback)
│   ├── auth-middleware.js  # JWT, bcrypt, middleware de auth
│   ├── tree-auth.js       # Middleware de autorização por árvore
│   ├── email.js           # Nodemailer (SMTP) para convites
│   ├── gedcom-parser.js   # Parser GEDCOM → JSON
│   └── gedcom-builder.js  # Builder JSON → GEDCOM
├── routes/
│   ├── auth.js            # Rotas de autenticação
│   ├── trees.js           # Gestão de árvores + membros
│   ├── genealogy.js       # CRUD genealógico tree-scoped
│   ├── invitations.js     # Convites por email
│   ├── notifications.js   # Notificações in-app
│   └── admin.js           # API admin (stats, users, trees, logins)
├── migrations/
│   ├── 001_initial_schema.js  # Schema completo (9 tabelas)
│   ├── 002_seed_legacy_tree.js
│   └── run.js             # Runner de migrações
├── scripts/
│   └── migrate-json-to-pg.js  # Migração JSON → PostgreSQL
├── css/
│   ├── style.css          # Design system (dark theme)
│   ├── family-chart.css
│   ├── livro.css
│   └── sys-dates.css
├── uploads/               # Ficheiros carregados (por árvore)
│   └── <treeId>/fotos/
└── JSON-DATA/             # Dados legados (fallback sem PG)
```

---

### API de dados

Todas as rotas (excepto `/api/auth/*`) requerem autenticação JWT (`Authorization: Bearer <token>`).

#### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Registo (nome, email, password) |
| `POST` | `/api/auth/login` | Login → access + refresh tokens |
| `POST` | `/api/auth/refresh` | Renovar access token |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Dados do utilizador actual |
| `PUT` | `/api/auth/me` | Actualizar perfil |
| `PUT` | `/api/auth/me/password` | Alterar password |
| `POST` | `/api/auth/totp/setup` | Iniciar configuração TOTP 2FA |
| `POST` | `/api/auth/totp/verify` | Verificar código TOTP |
| `DELETE` | `/api/auth/totp` | Desactivar TOTP |

#### Gestão de árvores

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/trees` | Listar árvores do utilizador |
| `POST` | `/api/trees` | Criar nova árvore |
| `GET` | `/api/trees/:treeId` | Detalhes da árvore |
| `PUT` | `/api/trees/:treeId` | Actualizar nome/descrição |
| `DELETE` | `/api/trees/:treeId` | Eliminar árvore (owner) |
| `GET` | `/api/trees/:treeId/members` | Listar membros |
| `POST` | `/api/trees/:treeId/members` | Adicionar membro |
| `PUT` | `/api/trees/:treeId/members/:userId` | Alterar role |
| `DELETE` | `/api/trees/:treeId/members/:userId` | Remover membro |

#### CRUD genealógico (tree-scoped)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/trees/:treeId/:entity` | Lista registos activos |
| `GET` | `/api/trees/:treeId/:entity?includeDeleted=true` | Incluindo soft-deleted |
| `GET` | `/api/trees/:treeId/:entity/:id` | Ler registo por ID |
| `POST` | `/api/trees/:treeId/:entity` | Criar registo (writer+) |
| `PUT` | `/api/trees/:treeId/:entity/:id` | Actualizar registo (writer+) |
| `DELETE` | `/api/trees/:treeId/:entity/:id` | Soft-delete (writer+) |
| `POST` | `/api/trees/:treeId/upload` | Upload de ficheiro (multipart) |
| `POST` | `/api/trees/:treeId/bulk-replace` | Substituir colecções |
| `GET` | `/api/trees/:treeId/stats` | Estatísticas da árvore |
| `GET` | `/api/trees/:treeId/gedcom/export` | Exportar GEDCOM 7 |
| `POST` | `/api/trees/:treeId/gedcom/import` | Importar GEDCOM |

#### Convites & Notificações

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/trees/:treeId/invitations` | Enviar convite por email |
| `GET` | `/api/invitations` | Convites do utilizador |
| `POST` | `/api/invitations/:id/accept` | Aceitar convite |
| `POST` | `/api/invitations/:id/decline` | Recusar convite |
| `GET` | `/api/notifications` | Listar notificações |
| `GET` | `/api/notifications/unread-count` | Contagem de não lidas |
| `PUT` | `/api/notifications/:id/read` | Marcar como lida |

#### Admin (requer `isAdmin`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/stats` | Estatísticas globais da plataforma |
| `GET` | `/api/admin/users` | Listar todos os utilizadores |
| `GET` | `/api/admin/trees` | Listar todas as árvores |
| `GET` | `/api/admin/logins` | Login audit log |

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

A suite de testes cobre CRUD de todas as entidades, conformidade GEDCOM 7, importação/exportação, autenticação, gestão de árvores e fluxos de integração multi-entidade.

```bash
npm install          # instalar dependências (inclui jest e supertest)
npm test             # testes unitários + integração
npm run test:unit    # só unitários
npm run test:integration  # só integração
npm run test:coverage    # com relatório de cobertura
```

### Ficheiros de teste

| Ficheiro | Cobertura |
|---|---|
| `tests/unit/individuals.test.js` | CRUD de indivíduos |
| `tests/unit/families.test.js` | CRUD de famílias |
| `tests/unit/sources.test.js` | CRUD de fontes |
| `tests/unit/multimedia.test.js` | CRUD de multimédia |
| `tests/unit/notes.test.js` | CRUD de notas |
| `tests/unit/repositories.test.js` | CRUD de repositórios |
| `tests/unit/gedcom-*.test.js` | Conformidade, import/export GEDCOM |
| `tests/integration/api-flow.test.js` | Fluxo multi-entidade (3 gerações) |
| `tests/integration/gedcom-roundtrip.test.js` | Import → export → import |
| `tests/integration/auth-flow.test.js` | Registo, login, refresh, profile |
| `tests/integration/trees-flow.test.js` | CRUD de árvores, isolamento de dados |

Consulte **[tests/README.md](tests/README.md)** para detalhes completos.
