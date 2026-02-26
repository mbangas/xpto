# myLineage JSON storage helper

This workspace addition provides a small Express server (`server.js`) and a client shim (`remote-storage.js`) that synchronize the app's current `localStorage` usage with JSON files stored in `JSON-DATA/`.

Quick start:

1. Install dependencies:

```bash
npm install
```

2. Run the server:

```bash
npm start
```

The server serves the app statically and exposes a simple CRUD API at `/api/data/:key` which reads/writes files in `JSON-DATA/` (filenames are `encodeURIComponent(key) + .json`). The client shim (`remote-storage.js`) must be included before other scripts so it can populate `localStorage` synchronously on page load.


---

Resumo técnico rápido:

server.js expõe uma API CRUD em /api/data/:key que lê/escreve ficheiros em JSON-DATA (nome do ficheiro = encodeURIComponent(key) + .json).
remote-storage.js (carregado antes de outros scripts) popula localStorage a partir do servidor de forma síncrona ao carregar a página e sobrepõe localStorage.setItem / removeItem para enviar atualizações ao servidor (POST/DELETE). Assim o código existente que usa localStorage continua a funcionar sem grandes refatorações.
O ficheiro salvo contém o JSON original quando possível; se o valor não for JSON válido é guardado sob { "__raw__": "<string>" }.
Testar localmente (no workspace):

Instalar dependências:
Iniciar o servidor:
Abrir a aplicação em http://localhost:3000 e verificar operações de CRUD (criar/editar/remover dados nas páginas terá como efeito a criação/atualização/remoção dos ficheiros em JSON-DATA).