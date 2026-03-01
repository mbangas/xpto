# myLineage — Testes

## Índice

1. [Organização das pastas](#organização-das-pastas)
2. [Pré-requisitos](#pré-requisitos)
3. [Como executar os testes](#como-executar-os-testes)
   - [Testes unitários](#testes-unitários)
   - [Testes de integração](#testes-de-integração)
   - [Testes E2E](#testes-e2e)
   - [Todos os testes automatizados](#todos-os-testes-automatizados)
4. [Automatização com GitHub Actions](#automatização-com-github-actions)
5. [Cobertura de código](#cobertura-de-código)

---

## Organização das pastas

```
tests/
├── README.md                      # este ficheiro
├── helpers/
│   └── setup.js                   # utilitário partilhado: cria tmp DATA_DIR isolado para cada test suite
│
├── unit/                          # Testes unitários — Jest + supertest (sem servidor real)
│   ├── individuals.test.js        # CRUD de Indivíduos (INDI) + compliance GEDCOM 7
│   ├── families.test.js           # CRUD de Famílias (FAM) + todos os graus de parentesco
│   ├── sources.test.js            # CRUD de Fontes (SOUR)
│   ├── repositories.test.js       # CRUD de Repositórios (REPO)
│   ├── multimedia.test.js         # CRUD de Multimédia (OBJE)
│   ├── notes.test.js              # CRUD de Notas (NOTE)
│   ├── gedcom-import.test.js      # Parser GEDCOM 7 (lib pura + endpoint POST /api/gedcom/import)
│   ├── gedcom-export.test.js      # Builder GEDCOM 7 (lib pura + endpoint GET /api/gedcom/export)
│   └── gedcom-compliance.test.js  # Compliance total GEDCOM 7: parentesco, eventos, atributos, nomes
│
├── integration/                   # Testes de integração — fluxos completos multi-entidade
│   ├── api-flow.test.js           # Árvore de 3 gerações; stats; soft-delete; bulk-replace; utilitários
│   └── gedcom-roundtrip.test.js   # Import → Export → Re-import; verificação de consistência total
│
└── e2e/
    └── e2e-test.sh                # Testes E2E em bash (requerem servidor real em execução na porta 3000)
```

### Filosofia de cada camada

| Camada | Ferramentas | O que testa | Requisitos |
|---|---|---|---|
| **Unitários** (`unit/`) | Jest + supertest | Cada endpoint/função de forma isolada. Cada ficheiro usa um diretório temporário próprio (`/tmp/ml-*`) — sem efeitos colaterais entre testes. | Apenas `npm install` |
| **Integração** (`integration/`) | Jest + supertest | Fluxos completos que atravessam múltiplas entidades (e.g., criar árvore genealógica, exportar GEDCOM, reimportar). Cada suite tem o seu próprio diretório isolado. | Apenas `npm install` |
| **E2E** (`e2e/`) | Bash + curl | Servidor HTTP real em execução. Testa a API REST completa + comportamento das páginas HTML. | Servidor a correr (`npm start`) |

---

## Pré-requisitos

```bash
# Instalar dependências (incluindo Jest e supertest)
npm install
```

Versão mínima de Node.js: **18**.

---

## Como executar os testes

### Testes unitários

```bash
# Todos os unitários (verbose)
npm run test:unit

# Apenas um ficheiro
npx jest tests/unit/individuals.test.js --verbose

# Apenas um grupo dentro de um ficheiro (match pelo nome do describe/test)
npx jest tests/unit/families.test.js --verbose -t "Sibling relationship"
```

### Testes de integração

```bash
# Todos os de integração (verbose)
npm run test:integration

# Apenas um ficheiro
npx jest tests/integration/gedcom-roundtrip.test.js --verbose
```

### Todos os testes automatizados (unitários + integração)

```bash
# Executar unitários + integração
npm run test:all

# Forma curta (Jest descobre automaticamente os dois grupos via testMatch em package.json)
npm test
```

### Testes E2E

Os testes E2E requerem o servidor real em execução:

```bash
# Terminal 1 — arrancar o servidor
npm start

# Terminal 2 — executar os E2E
bash tests/e2e/e2e-test.sh
```

Ou, numa única linha (aguarda o servidor estar pronto):

```bash
npm start & sleep 5 && bash tests/e2e/e2e-test.sh
```

---

## Automatização com GitHub Actions

Para correr os testes automaticamente em cada `push` ou `pull_request`, cria o ficheiro `.github/workflows/tests.yml` na raíz do repositório:

```yaml
name: Tests

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  unit-and-integration:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Instalar dependências
        run: npm ci

      - name: Correr testes unitários e de integração
        run: npm run test:all

      - name: Publicar relatório de cobertura (opcional)
        if: always()
        run: npm run test:coverage

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: unit-and-integration   # Só corre E2E se os unitários passarem

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Instalar dependências
        run: npm ci

      - name: Arrancar servidor em background
        run: |
          # Usa dados temporários para não sujar o ambiente CI
          DATA_DIR=$(mktemp -d) node server.js &
          echo "Aguardar servidor..."
          for i in $(seq 1 15); do
            curl -s http://localhost:3000/ > /dev/null && break || sleep 1
          done

      - name: Correr testes E2E
        run: bash tests/e2e/e2e-test.sh
```

### Como activar no GitHub

1. Cria a pasta `.github/workflows/` na raíz do repositório (se não existir).
2. Adiciona o ficheiro `tests.yml` com o conteúdo acima.
3. Faz commit e push.
4. Na página do repositório → separador **Actions** — vês os workflows a executar automaticamente.

### Badges de estado

Podes adicionar ao `README.md` raíz um badge do estado dos testes:

```markdown
[![Tests](https://github.com/mbangas/myLineage/actions/workflows/tests.yml/badge.svg)](https://github.com/mbangas/myLineage/actions/workflows/tests.yml)
```

---

## Cobertura de código

```bash
# Gera relatório de cobertura em tests/coverage/
npm run test:coverage

# Ver relatório no browser (depois de gerar)
open tests/coverage/lcov-report/index.html
# ou no Linux:
xdg-open tests/coverage/lcov-report/index.html
```

O relatório cobre os módulos em `lib/` e `server.js`.
