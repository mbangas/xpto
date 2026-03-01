# ─────────────────────────────────────────────────────────────────────────────
#  myLineage — Dockerfile
#  Imagem de produção para o servidor genealógico GEDCOM 7
# ─────────────────────────────────────────────────────────────────────────────

# ── Fase 1: Build ─────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# 1. Instalar dependências (camada em cache se package.json não mudar)
COPY package*.json ./
RUN npm ci

# 2. Copiar todo o código-fonte
COPY . .

# 3. Compilar os bundles JS (topola + family-chart via esbuild)
RUN npm run build:all

# ── Fase 2: Runtime ───────────────────────────────────────────────────────────
FROM node:18-alpine AS runtime

LABEL maintainer="myLineage"
LABEL description="Aplicação de genealogia GEDCOM 7"
LABEL version="2.0"

WORKDIR /app

# Copiar apenas os artefactos necessários para produção
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
COPY --from=builder /app/remote-storage.js ./
COPY --from=builder /app/history-logger.js ./
COPY --from=builder /app/*.html ./
COPY --from=builder /app/topola-bundle.js ./
COPY --from=builder /app/family-chart-bundle.js ./
COPY --from=builder /app/qrcode-bundle.js ./
COPY --from=builder /app/css ./css

# Criar diretórios de dados e uploads
RUN mkdir -p \
    /app/JSON-DATA \
    /app/uploads/fotos \
    /app/uploads/documentos \
    /app/uploads/gedcom

# Utilizador sem privilégios de root
RUN addgroup -S mylineage && adduser -S mylineage -G mylineage \
    && chown -R mylineage:mylineage /app

USER mylineage

EXPOSE 3000

# Health check — verifica se o servidor responde
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:3000 > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
