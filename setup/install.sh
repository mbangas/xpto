#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#
#   🌳  m y L i n e a g e  —  Instalador Automático  v2.0
#
#   Genealogia familiar · GEDCOM 7 · Node.js + Docker + Portainer
#
#   Suporta: Debian 11/12 · Ubuntu 22.04/24.04
#   Destino:  LXC em Proxmox (acabado de criar, sem Docker)
#
#   Uso:
#       bash install.sh            (como root ou com sudo)
#       sudo bash install.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Constantes ─────────────────────────────────────────────────────────────────
readonly REPO_URL="https://github.com/mbangas/myLineage.git"
readonly LOG="/tmp/mylineage_install_$(date +%Y%m%d_%H%M%S).log"
readonly PIPE="/tmp/mylineage_gauge_$$"
readonly TITLE="🌳  myLineage — Instalador"

APP_DIR="/opt/mylineage"
APP_PORT="3000"
PORTAINER_HTTPS_PORT="9443"
PORTAINER_TUNNEL_PORT="8000"

VOL_FOTOS="/data/mylineage/fotos"
VOL_DOCS="/data/mylineage/documentos"
VOL_GEDCOM="/data/mylineage/gedcom"
VOL_DATA="/data/mylineage/data"

ADMIN_PHONE=""

OS_ID=""
OS_VER=""
OS_NAME=""
SERVER_IP=""

# ── Utilitários de log ─────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"        >> "$LOG"; }
logn() { printf   "[$(date '+%H:%M:%S')] $*\n"  >> "$LOG"; }

# ── Barra de progresso (named pipe + whiptail --gauge) ─────────────────────────
GAUGE_PID=""

gauge_open() {
    mkfifo "$PIPE"
    whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "$TITLE" \
        --gauge "A iniciar a instalação..." \
        10 72 0 < "$PIPE" &
    GAUGE_PID=$!
    exec 4>"$PIPE"          # fd 4  →  gauge stdin
}

gauge_update() {            # gauge_update <pct> <mensagem>
    local pct="$1"
    local msg="$2"
    printf 'XXX\n%s\n%s\nXXX\n' "$pct" "$msg" >&4
}

gauge_close() {
    exec 4>&-
    wait "$GAUGE_PID" 2>/dev/null || true
    rm -f "$PIPE"
}

# ── Verificar root ─────────────────────────────────────────────────────────────
check_root() {
    if [[ $EUID -ne 0 ]]; then
        # whiptail pode ainda não estar instalado — usar echo simples
        echo ""
        echo "  ╔══════════════════════════════════════════╗"
        echo "  ║   ERRO: Execute como root ou com sudo    ║"
        echo "  ║                                          ║"
        echo "  ║   sudo bash install.sh                   ║"
        echo "  ╚══════════════════════════════════════════╝"
        echo ""
        exit 1
    fi
}

# ── Instalar whiptail (se necessário) ──────────────────────────────────────────
ensure_whiptail() {
    if ! command -v whiptail &>/dev/null; then
        echo " → A instalar whiptail..."
        apt-get update -qq && apt-get install -y -qq whiptail
    fi
}

# ── Detectar sistema operativo ─────────────────────────────────────────────────
detect_os() {
    if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        OS_ID="${ID:-unknown}"
        OS_VER="${VERSION_ID:-0}"
        OS_NAME="${PRETTY_NAME:-Desconhecido}"
    fi

    if [[ "$OS_ID" != "debian" && "$OS_ID" != "ubuntu" ]]; then
        whiptail \
            --backtitle "myLineage Installer  v2.0" \
            --title "Sistema Operativo Não Suportado" \
            --msgbox \
"Sistema detectado: ${OS_NAME:-Desconhecido}

Este instalador suporta apenas:
  •  Debian 11 (Bullseye)
  •  Debian 12 (Bookworm)
  •  Ubuntu 22.04 LTS (Jammy)
  •  Ubuntu 24.04 LTS (Noble)

Por favor instale uma dessas versões no seu LXC
e execute o instalador novamente." \
            18 60
        exit 1
    fi
    log "SO detectado: $OS_NAME (ID=$OS_ID  VER=$OS_VER)"
}

# ── Ecrã de boas-vindas ────────────────────────────────────────────────────────
show_welcome() {
    whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "$TITLE" \
        --msgbox \
"
          ╔╦╗╦ ╦  ╦  ╦╔╗╔╔═╗╔═╗╔═╗╔═╗
          ║║║╚╦╝  ║  ║║║║║╣ ╠═╣║ ╦║╣
          ╩ ╩ ╩   ╩═╝╩╝╚╝╚═╝╩ ╩╚═╝╚═╝
              Genealogia Familiar · v2.0
         ─────────────────────────────────────
          Explorar · Preservar · Conectar
              a sua história familiar
         ─────────────────────────────────────

  Sistema detectado: ${OS_NAME}

  O instalador irá executar automaticamente:

   [1]  Actualizar o sistema operativo
   [2]  Instalar Docker CE
   [3]  Instalar Portainer (gestão Docker)
   [4]  Configurar volumes de dados
   [5]  Descarregar myLineage do GitHub
   [6]  Compilar a imagem Docker
   [7]  Iniciar todos os serviços

  Prima  OK  para continuar." \
        32 66
}

# ── Confirmação ────────────────────────────────────────────────────────────────
confirm_install() {
    whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "$TITLE" \
        --yesno \
"Pronto para instalar myLineage no seu servidor.

  Directório de instalação : ${APP_DIR}
  Sistema operativo         : ${OS_NAME}
  Log de instalação         : ${LOG}

A instalação pode demorar alguns minutos
dependendo da velocidade da ligação à Internet
e dos recursos do servidor.

Deseja continuar?" \
        16 66
}

# ── Perguntar porta ────────────────────────────────────────────────────────────
ask_config() {
    # Porta da aplicação
    APP_PORT=$(whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "⚙️   Configuração — Porta da Aplicação" \
        --inputbox \
"Porta onde o myLineage ficará disponível.

Depois da instalação, a aplicação estará
acessível em:
  http://<IP-do-servidor>:<porta>

Porta (recomendado: 3000):" \
        14 62 "3000" 3>&1 1>&2 2>&3) || exit 0

    # Directório de instalação
    APP_DIR=$(whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "⚙️   Configuração — Directório de Instalação" \
        --inputbox \
"Directório onde o código do myLineage
será instalado no servidor.

Directório de instalação:" \
        12 62 "/opt/mylineage" 3>&1 1>&2 2>&3) || exit 0

    # Telemóvel do administrador
    ADMIN_PHONE=$(whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "🔐  Configuração — Administrador" \
        --inputbox \
"Telemóvel do administrador do myLineage.

Este número terá acesso total à aplicação
e será o primeiro a configurar o
Microsoft Authenticator (TOTP).

Formato: +351910000000
Telemóvel do administrador:" \
        16 62 "" 3>&1 1>&2 2>&3) || exit 0

    # Validar número de telefone (deve começar com + e ter pelo menos 8 dígitos)
    while [[ ! "$ADMIN_PHONE" =~ ^\+[0-9]{7,} ]]; do
        ADMIN_PHONE=$(whiptail \
            --backtitle "myLineage Installer  v2.0" \
            --title "⚠️   Telemóvel Inválido" \
            --inputbox \
"Número inválido. Deve começar com +
e ter pelo menos 8 dígitos.

Exemplo: +351910000000

Telemóvel do administrador:" \
            14 62 "" 3>&1 1>&2 2>&3) || exit 0
    done
}

# ── Perguntar volumes ──────────────────────────────────────────────────────────
ask_volumes() {
    whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "💾  Volumes de Dados" \
        --msgbox \
"A seguir irá configurar os três volumes
de dados da aplicação.

  📸  Volume de Fotografias
      → Imagens associadas às pessoas

  📄  Volume de Documentos
      → PDFs, imagens de documentos, etc.

  🗂️   Volume GEDCOM
      → Ficheiros .ged para importação
        e exportação

Os caminhos indicados serão criados
automaticamente se não existirem." \
        22 62

    # Volume — Fotografias
    VOL_FOTOS=$(whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "📸  Volume — Fotografias" \
        --inputbox \
"Caminho no servidor para guardar as
fotografias e imagens da aplicação.

Será criado automaticamente se não existir.

Caminho:" \
        14 62 "/data/mylineage/fotos" 3>&1 1>&2 2>&3) || exit 0

    # Volume — Documentos
    VOL_DOCS=$(whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "📄  Volume — Documentos" \
        --inputbox \
"Caminho no servidor para guardar os
documentos (PDF, imagens, etc.).

Será criado automaticamente se não existir.

Caminho:" \
        14 62 "/data/mylineage/documentos" 3>&1 1>&2 2>&3) || exit 0

    # Volume — GEDCOM
    VOL_GEDCOM=$(whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "🗂️   Volume — Ficheiros GEDCOM" \
        --inputbox \
"Caminho no servidor para os ficheiros
GEDCOM (.ged) de importação e exportação.

Será criado automaticamente se não existir.

Caminho:" \
        14 62 "/data/mylineage/gedcom" 3>&1 1>&2 2>&3) || exit 0

    # Volume — Base de Dados JSON
    VOL_DATA=$(whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "🗄️   Volume — Base de Dados" \
        --inputbox \
"Caminho no servidor para os ficheiros
JSON que guardam todos os registos
(indivíduos, famílias, fontes, etc.).

Este volume é o mais importante:
faça backups regulares!

Caminho:" \
        16 62 "/data/mylineage/data" 3>&1 1>&2 2>&3) || exit 0

    # Confirmação dos volumes
    whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "✅  Confirmar Volumes" \
        --yesno \
"Os seguintes volumes serão configurados:

  📸  Fotografias   →  ${VOL_FOTOS}

  📄  Documentos    →  ${VOL_DOCS}

  🗂️   GEDCOM        →  ${VOL_GEDCOM}

  🗄️   Dados JSON    →  ${VOL_DATA}

Os directórios são criados automaticamente
se ainda não existirem.

Confirmar?" \
        22 66 || ask_volumes
}

# ── PASSO 1: Actualizar sistema ────────────────────────────────────────────────
step_update_system() {
    log "=== PASSO 1: Actualizar sistema ==="
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq                                      >> "$LOG" 2>&1
    apt-get upgrade -y -qq                                  >> "$LOG" 2>&1
    apt-get install -y -qq \
        curl wget git ca-certificates gnupg \
        lsb-release apt-transport-https \
        software-properties-common \
        ufw                                                 >> "$LOG" 2>&1
    log "Sistema actualizado com sucesso."
}

# ── PASSO 2: Instalar Docker CE ────────────────────────────────────────────────
step_install_docker() {
    log "=== PASSO 2: Instalar Docker ==="

    if command -v docker &>/dev/null; then
        log "Docker já está instalado: $(docker --version)"
        return 0
    fi

    # Remover versões antigas (ignora erros)
    apt-get remove -y -qq \
        docker docker-engine docker.io containerd runc \
        2>/dev/null >> "$LOG" 2>&1 || true

    # Configurar chave GPG e repositório
    install -m 0755 -d /etc/apt/keyrings

    if [[ "$OS_ID" == "ubuntu" ]]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg >> "$LOG" 2>&1
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
           https://download.docker.com/linux/ubuntu \
           $(lsb_release -cs) stable" \
          > /etc/apt/sources.list.d/docker.list
    else
        # Debian
        curl -fsSL https://download.docker.com/linux/debian/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg >> "$LOG" 2>&1
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
           https://download.docker.com/linux/debian \
           $(lsb_release -cs) stable" \
          > /etc/apt/sources.list.d/docker.list
    fi

    apt-get update -qq                                      >> "$LOG" 2>&1
    apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin          >> "$LOG" 2>&1

    systemctl enable --now docker                           >> "$LOG" 2>&1
    log "Docker instalado: $(docker --version)"
}

# ── PASSO 3: Instalar Portainer ────────────────────────────────────────────────
step_install_portainer() {
    log "=== PASSO 3: Instalar Portainer ==="

    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^portainer$"; then
        log "Portainer já está instalado."
        return 0
    fi

    docker volume create portainer_data                     >> "$LOG" 2>&1

    docker run -d \
        --name portainer \
        --restart=always \
        -p "${PORTAINER_TUNNEL_PORT}:8000" \
        -p "${PORTAINER_HTTPS_PORT}:9443" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        portainer/portainer-ce:latest                       >> "$LOG" 2>&1

    log "Portainer instalado (porta HTTPS: ${PORTAINER_HTTPS_PORT})"
}

# ── PASSO 4: Criar directórios dos volumes ─────────────────────────────────────
step_create_volumes() {
    log "=== PASSO 4: Criar volumes ==="
    mkdir -p "$VOL_FOTOS" "$VOL_DOCS" "$VOL_GEDCOM" "$VOL_DATA" "$APP_DIR"
    chmod 755 "$VOL_FOTOS" "$VOL_DOCS" "$VOL_GEDCOM" "$VOL_DATA"
    log "Directórios criados: $VOL_FOTOS | $VOL_DOCS | $VOL_GEDCOM | $VOL_DATA"
}

# ── PASSO 5: Clonar repositório ────────────────────────────────────────────────
step_clone_repo() {
    log "=== PASSO 5: Clonar repositório ==="
    if [[ -d "$APP_DIR/.git" ]]; then
        log "Repositório já existe — a actualizar..."
        git -C "$APP_DIR" pull                              >> "$LOG" 2>&1
    else
        git clone "$REPO_URL" "$APP_DIR"                    >> "$LOG" 2>&1
    fi
    log "Repositório disponível em: $APP_DIR"
}

# ── PASSO 6: Criar Dockerfile ──────────────────────────────────────────────────
step_create_dockerfile() {
    log "=== PASSO 6a: Criar Dockerfile ==="
    # O Dockerfile já vem no repositório clonado do GitHub.
    # Esta função garante que existe, mesmo que o clone falhe parcialmente.
    if [[ -f "$APP_DIR/Dockerfile" ]]; then
        log "Dockerfile já presente no repositório."
        return 0
    fi

    log "Dockerfile não encontrado — a criar versão de fallback..."
    cat > "$APP_DIR/Dockerfile" << 'DOCKERFILE_CONTENT'
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:all

FROM node:18-alpine AS runtime
WORKDIR /app
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
RUN mkdir -p /app/JSON-DATA /app/uploads/fotos /app/uploads/documentos /app/uploads/gedcom
RUN addgroup -S mylineage && adduser -S mylineage -G mylineage \
    && chown -R mylineage:mylineage /app
USER mylineage
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:3000 > /dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
DOCKERFILE_CONTENT
    log "Dockerfile de fallback criado."
}

# ── PASSO 7: Criar docker-compose.yml ─────────────────────────────────────────
step_create_compose() {
    log "=== PASSO 6b: Criar docker-compose.yml ==="
    cat > "$APP_DIR/docker-compose.yml" << COMPOSE_CONTENT
# ─────────────────────────────────────────────────────────────────────────────
#  myLineage — docker-compose.yml
#  Gerado automaticamente pelo instalador em $(date)
# ─────────────────────────────────────────────────────────────────────────────

services:

  mylineage:
    build:
      context: .
      dockerfile: Dockerfile
    image: mylineage:latest
    container_name: mylineage
    restart: unless-stopped

    ports:
      - "${APP_PORT}:3000"

    volumes:
      # Base de dados JSON (registos genealógicos — IMPORTANTE: fazer backups)
      - ${VOL_DATA}:/app/JSON-DATA

      # Galeria de fotografias
      - ${VOL_FOTOS}:/app/uploads/fotos

      # Biblioteca de documentos
      - ${VOL_DOCS}:/app/uploads/documentos

      # Ficheiros GEDCOM de importação / exportação
      - ${VOL_GEDCOM}:/app/uploads/gedcom

    environment:
      - NODE_ENV=production
      - PORT=3000

    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    labels:
      - "com.mylineage.version=2.0"
      - "com.mylineage.install-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      - "com.mylineage.managed=true"
COMPOSE_CONTENT
    log "docker-compose.yml criado em $APP_DIR/docker-compose.yml"
}

# ── PASSO 7b: Semear dados iniciais + adminPhone ─────────────────────────────
step_seed_data() {
    log "=== PASSO 7b: Semear dados iniciais ==="

    # Copiar ficheiros JSON de seed para o volume (apenas se ainda não existirem)
    local src="$APP_DIR/JSON-DATA"
    if [[ -d "$src" ]]; then
        for f in "$src"/*.json; do
            [[ -f "$f" ]] || continue
            local dest="$VOL_DATA/$(basename "$f")"
            if [[ ! -f "$dest" ]]; then
                cp "$f" "$dest"
                log "Copiado: $dest"
            fi
        done
    fi

    # Injectar adminPhone em settings.json
    local settings="$VOL_DATA/settings.json"
    if [[ ! -f "$settings" ]]; then
        echo '{"adminPhone":"'"$ADMIN_PHONE"'"}' > "$settings"
        log "settings.json criado com adminPhone=$ADMIN_PHONE"
    else
        # Usar python3 para atualizar o campo adminPhone
        python3 - <<PYEOF
import json, sys
path = "$settings"
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {}
data['adminPhone'] = "$ADMIN_PHONE"
with open(path, 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('adminPhone definido:', "$ADMIN_PHONE")
PYEOF
        log "settings.json actualizado: adminPhone=$ADMIN_PHONE"
    fi
}

# ── PASSO 8: Build e arranque ──────────────────────────────────────────────────
step_build_and_start() {
    log "=== PASSO 7: Build e arranque Docker ==="
    cd "$APP_DIR"
    docker compose build --no-cache                         >> "$LOG" 2>&1
    docker compose up -d                                    >> "$LOG" 2>&1
    log "Containers iniciados."
}

# ── Aguardar serviço ficar disponível ──────────────────────────────────────────
wait_for_service() {
    log "A aguardar o serviço iniciar..."
    local waited=0
    local max=90
    while ! curl -sf "http://localhost:${APP_PORT}" > /dev/null 2>&1; do
        sleep 3
        waited=$((waited + 3))
        if (( waited >= max )); then
            log "AVISO: Serviço não disponível após ${max}s (pode ainda estar a iniciar)."
            return 0
        fi
    done
    log "Serviço disponível após ${waited}s."
}

# ── Obter IP do servidor ───────────────────────────────────────────────────────
get_server_ip() {
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
    [[ -z "$SERVER_IP" ]] && SERVER_IP="127.0.0.1"
}

# ── Ecrã final — Próximos Passos ───────────────────────────────────────────────
show_next_steps() {
    get_server_ip
    whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "🎉  Instalação Concluída!" \
        --msgbox \
"
   A instalação foi concluída com sucesso!

  ╔══════════════════════════════════════════════════╗
  ║  🌳  ACESSO AO myLineage                        ║
  ╠══════════════════════════════════════════════════╣
  ║  Interface Web (frontend):                       ║
  ║    http://${SERVER_IP}:${APP_PORT}              ║
  ║                                                  ║
  ║  Referência das APIs REST:                       ║
  ║    http://${SERVER_IP}:${APP_PORT}/apis.html    ║
  ╠══════════════════════════════════════════════════╣
  ║  🔐  PRIMEIRO LOGIN (Microsoft Authenticator)   ║
  ╠══════════════════════════════════════════════════╣
  ║  Administrador: ${ADMIN_PHONE}
  ║                                                  ║
  ║  1. Abra a aplicação no browser                  ║
  ║  2. Introduza o telem. acima                     ║
  ║  3. Leia o QR code com o Microsoft               ║
  ║     Authenticator no telemóvel                   ║
  ║  4. Valide o código de 6 dígitos                 ║
  ╠══════════════════════════════════════════════════╣
  ║  🐳  PORTAINER (Gestão Docker)                  ║
  ╠══════════════════════════════════════════════════╣
  ║  Interface Web:                                  ║
  ║    https://${SERVER_IP}:${PORTAINER_HTTPS_PORT} ║
  ║  (1ª vez: crie o utilizador administrador)       ║
  ╠══════════════════════════════════════════════════╣
  ║  📁  VOLUMES DE DADOS                           ║
  ╠══════════════════════════════════════════════════╣
  ║  Fotografias  →  ${VOL_FOTOS}
  ║  Documentos   →  ${VOL_DOCS}
  ║  GEDCOM       →  ${VOL_GEDCOM}
  ║  Dados JSON   →  ${VOL_DATA}
  ╠══════════════════════════════════════════════════╣
  ║  📋  COMANDOS ÚTEIS                             ║
  ╠══════════════════════════════════════════════════╣
  ║  Ver logs em tempo real:                         ║
  ║    docker logs mylineage -f                      ║
  ║                                                  ║
  ║  Parar a aplicação:                              ║
  ║    docker compose -f ${APP_DIR}/docker-compose.yml down
  ║                                                  ║
  ║  Actualizar para nova versão:                    ║
  ║    cd ${APP_DIR} && git pull                     ║
  ║    docker compose up -d --build                  ║
  ║                                                  ║
  ║  Log de instalação completo:                     ║
  ║    ${LOG}
  ╚══════════════════════════════════════════════════╝

  Prima OK para terminar." \
        44 72
}

# ══════════════════════════════════════════════════════════════════════════════
#   PROGRAMA PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

# Inicializar log
: > "$LOG"
log "myLineage Instalador v2.0 — $(date)"
log "Repositório: $REPO_URL"

# Verificar root
check_root

# Garantir que whiptail está disponível
ensure_whiptail

# Detectar SO
detect_os

# Ecrã de boas-vindas
show_welcome

# Confirmação
if ! confirm_install; then
    whiptail \
        --backtitle "myLineage Installer  v2.0" \
        --title "Instalação Cancelada" \
        --msgbox "Instalação cancelada pelo utilizador.\n\nPode re-executar o instalador a qualquer momento:\n  sudo bash install.sh" \
        10 54
    exit 0
fi

# Recolher configurações
ask_config
ask_volumes

log "Configuração: APP_DIR=$APP_DIR  PORT=$APP_PORT  ADMIN_PHONE=$ADMIN_PHONE"
log "Volumes: FOTOS=$VOL_FOTOS  DOCS=$VOL_DOCS  GEDCOM=$VOL_GEDCOM  DATA=$VOL_DATA"

# ─── Execução com barra de progresso ──────────────────────────────────────────
gauge_open

gauge_update 3  "[ 1 / 8 ]  A actualizar o sistema operativo..."
step_update_system

gauge_update 15 "[ 2 / 8 ]  A instalar Docker CE..."
step_install_docker

gauge_update 35 "[ 3 / 8 ]  A instalar Portainer..."
step_install_portainer

gauge_update 48 "[ 4 / 8 ]  A criar directórios dos volumes..."
step_create_volumes

gauge_update 58 "[ 5 / 8 ]  A descarregar myLineage do GitHub..."
step_clone_repo

gauge_update 68 "[ 6 / 9 ]  A gerar Dockerfile e docker-compose.yml..."
step_create_dockerfile
step_create_compose

gauge_update 73 "[ 7 / 9 ]  A semear dados e configurar administrador..."
step_seed_data

gauge_update 78 "[ 8 / 9 ]  A compilar a imagem Docker (pode demorar...)..."
step_build_and_start

gauge_update 95 "[ 9 / 9 ]  A verificar se o serviço está disponível..."
wait_for_service

gauge_update 100 "  ✅  Instalação concluída com sucesso!"
sleep 2

gauge_close

# Ecrã final
show_next_steps

log "=== Instalação concluída em $(date) ==="
exit 0
