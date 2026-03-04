#!/usr/bin/env bash
# ===============================================================================
#
#   myLineage  --  Instalador Automatico  v2.1
#
#   Genealogia familiar - GEDCOM 7 - Node.js + Docker + Portainer
#
#   Suporta: Debian 11/12 · Ubuntu 22.04/24.04
#   Destino:  LXC em Proxmox (acabado de criar, sem Docker)
#
#   Uso:
#       bash install.sh            (como root ou com sudo)
#       sudo bash install.sh
#
# ===============================================================================

set -euo pipefail

# -- Constantes -----------------------------------------------------------------
readonly REPO_URL="https://github.com/mbangas/myLineage.git"
readonly LOG="/tmp/mylineage_install_$(date +%Y%m%d_%H%M%S).log"

APP_DIR="/root/myLineage"
APP_PORT="3000"
PORTAINER_HTTPS_PORT="9443"
PORTAINER_TUNNEL_PORT="8000"

ADMIN_PHONE=""

OS_ID=""
OS_VER=""
OS_NAME=""
SERVER_IP=""

_CURRENT_STEP="(inicializacao)"

# -- Utilitarios de log ---------------------------------------------------------
log()  { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }
info() { echo "  --> $*"; log "$*"; }
step() {
    _CURRENT_STEP="$*"
    echo ""
    echo "======================================================================"
    echo "  $*"
    echo "======================================================================"
    log "$*"
}

# -- Tratamento de erros -------------------------------------------------------
handle_error() {
    # Desactivar o trap imediatamente para evitar recursao
    trap '' ERR

    # Guardar o codigo de saida ANTES de qualquer outro comando
    local _ec=$?
    local _ln=${1:-"?"}

    echo "" >&2
    echo "======================================================================" >&2
    echo "  ERRO DURANTE A INSTALACAO" >&2
    echo "======================================================================" >&2
    echo "" >&2
    echo "  Passo  : ${_CURRENT_STEP}" >&2
    echo "  Linha  : ${_ln}" >&2
    echo "  Codigo : ${_ec}" >&2
    echo "  Log    : ${LOG}" >&2
    echo "" >&2
    echo "  Ultimas linhas do log:" >&2
    echo "  ------------------------------------------------------------------" >&2
    tail -20 "${LOG}" 2>/dev/null | sed 's/^/    /' >&2 || true
    echo "" >&2

    # Escrever no log sem falhar
    echo "[$(date '+%H:%M:%S')] ERRO: passo=[${_CURRENT_STEP}] linha=${_ln} codigo=${_ec}" >> "${LOG}" 2>/dev/null || true

    # Janela whiptail -- forcada para o terminal (/dev/tty) para funcionar
    # mesmo quando stdout/stderr estao redireccionados
    if command -v whiptail &>/dev/null && [[ -t 0 ]] || [[ -e /dev/tty ]]; then
        whiptail \
            --backtitle "myLineage Installer  v2.1" \
            --title "!! ERRO NA INSTALACAO !!" \
            --msgbox \
"Ocorreu um erro durante a instalacao.

  Passo  : ${_CURRENT_STEP}
  Codigo : ${_ec}

Ultimas linhas do log:
$(tail -8 "${LOG}" 2>/dev/null | sed 's/^/  /' || true)

Log completo:
  ${LOG}

Verifique:
  - Ligacao a Internet activa
  - Espaco em disco suficiente
  - Docker em execucao:
    systemctl status docker

Pode re-executar:
  sudo bash install.sh" \
            28 68 \
            </dev/tty >/dev/tty 2>/dev/null || true
    fi

    exit "${_ec}"
}

# -- Progresso no CLI -----------------------------------------------------------
progress() {   # progress <pct> <mensagem>
    local pct="$1"
    local msg="$2"
    local bar_len=40
    local filled=$(( pct * bar_len / 100 ))
    local empty=$(( bar_len - filled ))
    local bar=""
    for ((i=0; i<filled; i++)); do bar="${bar}#"; done
    for ((i=0; i<empty;  i++)); do bar="${bar}-"; done
    printf "\r  [%s] %3d%%  %s\n" "$bar" "$pct" "$msg"
    log "Progress ${pct}%: ${msg}"
}

# -- Verificar root -------------------------------------------------------------
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo ""
        echo "  ERRO: Execute como root ou com sudo"
        echo "  sudo bash install.sh"
        echo ""
        exit 1
    fi
}

# -- Instalar whiptail (se necessario) ------------------------------------------
ensure_whiptail() {
    if ! command -v whiptail &>/dev/null; then
        info "A instalar whiptail..."
        apt-get update -qq && apt-get install -y -qq whiptail
    fi
}

# -- Detectar sistema operativo -------------------------------------------------
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
            --backtitle "myLineage Installer  v2.1" \
            --title "Sistema Operativo Nao Suportado" \
            --msgbox \
"Sistema detectado: ${OS_NAME:-Desconhecido}

Este instalador suporta apenas:
  - Debian 11 (Bullseye)
  - Debian 12 (Bookworm)
  - Ubuntu 22.04 LTS (Jammy)
  - Ubuntu 24.04 LTS (Noble)

Por favor instale uma dessas versoes no seu LXC
e execute o instalador novamente." \
            18 60
        exit 1
    fi
    log "SO detectado: $OS_NAME (ID=$OS_ID  VER=$OS_VER)"
}

# -- Ecra de boas-vindas --------------------------------------------------------
show_welcome() {
    whiptail \
        --backtitle "myLineage Installer  v2.1" \
        --title "myLineage -- Instalador" \
        --msgbox \
"Bem-vindo ao instalador do myLineage v2.1
Genealogia Familiar - Explorar, Preservar, Conectar

Sistema detectado: ${OS_NAME}

O instalador ira executar automaticamente:

 [1]  Actualizar o sistema operativo
 [2]  Instalar Docker CE
 [3]  Instalar Portainer (gestao Docker)
 [4]  Descarregar myLineage do GitHub
 [5]  Compilar a imagem Docker
 [6]  Iniciar todos os servicos

ATENCAO: Este processo pode demorar varios minutos
(10 a 30 min dependendo da ligacao a Internet e
dos recursos do servidor). Por favor aguarde.

O progresso sera mostrado no terminal.

Prima OK para continuar." \
        26 64
}

# -- Confirmacao ----------------------------------------------------------------
confirm_install() {
    whiptail \
        --backtitle "myLineage Installer  v2.1" \
        --title "myLineage -- Instalador" \
        --yesno \
"Pronto para instalar myLineage no seu servidor.

  Directorio de instalacao : ${APP_DIR}
  Sistema operativo        : ${OS_NAME}
  Log de instalacao        : ${LOG}

ATENCAO: A instalacao e demorada (10-30 minutos).
O progresso sera mostrado no terminal.

Deseja continuar?" \
        16 64
}

# -- Perguntar porta e telemovel ------------------------------------------------
ask_config() {
    # Porta da aplicacao
    APP_PORT=$(whiptail \
        --backtitle "myLineage Installer  v2.1" \
        --title "Configuracao -- Porta da Aplicacao" \
        --inputbox \
"Porta onde o myLineage ficara disponivel.

Depois da instalacao, a aplicacao estara
acessivel em:
  http://<IP-do-servidor>:<porta>

Porta (recomendado: 3000):" \
        14 60 "3000" 3>&1 1>&2 2>&3) || exit 0

    # Telemovel do administrador
    ADMIN_PHONE=$(whiptail \
        --backtitle "myLineage Installer  v2.1" \
        --title "Configuracao -- Administrador" \
        --inputbox \
"Telemovel do administrador do myLineage.

Este numero tera acesso total a aplicacao
e sera o primeiro a configurar o
Microsoft Authenticator (TOTP).

Formato: +351910000000
Telemovel do administrador:" \
        16 60 "" 3>&1 1>&2 2>&3) || exit 0

    # Validar numero de telefone (deve comecar com + e ter pelo menos 8 digitos)
    while [[ ! "$ADMIN_PHONE" =~ ^\+[0-9]{7,} ]]; do
        ADMIN_PHONE=$(whiptail \
            --backtitle "myLineage Installer  v2.1" \
            --title "Telemovel Invalido" \
            --inputbox \
"Numero invalido. Deve comecar com +
e ter pelo menos 8 digitos.

Exemplo: +351910000000

Telemovel do administrador:" \
            14 60 "" 3>&1 1>&2 2>&3) || exit 0
    done
}

# -- Verificar que o Docker consegue arrancar contentores (nesting Proxmox) ----
# Em LXC nao privilegiado sem nesting=1, o runc falha sempre com
# "MS_PRIVATE: permission denied" independentemente do storage driver.
# Esta funcao detecta o problema cedo e mostra instrucoes claras.
check_lxc_nesting() {
    info "A verificar compatibilidade Docker/LXC..."

    local test_out
    test_out=$(docker run --rm --pull=never hello-world 2>&1) || true

    # Ignorar se a imagem nao existia localmente -- nao e erro de nesting
    if echo "$test_out" | grep -qi "Unable to find image\|No such image"; then
        log "check_lxc_nesting: imagem local ausente -- a ignorar"
        info "Verificacao de nesting ignorada (imagem local ausente)."
        return 0
    fi

    # O unico erro que indica falta de nesting e o MS_PRIVATE
    if echo "$test_out" | grep -q "MS_PRIVATE\|remount-private"; then
        log "check_lxc_nesting: FALHOU com MS_PRIVATE -- nesting nao activo"
        _fail_nesting "$test_out"
    fi

    info "Docker consegue correr contentores -- OK."
    log "check_lxc_nesting: OK"
}

# -- PASSO 1: Actualizar sistema ------------------------------------------------
step_update_system() {
    step "PASSO 1/6: Actualizar sistema operativo"
    export DEBIAN_FRONTEND=noninteractive
    info "A executar apt-get update..."
    apt-get update -qq                                      >> "$LOG" 2>&1
    info "A actualizar pacotes instalados..."
    apt-get upgrade -y -qq                                  >> "$LOG" 2>&1
    info "A instalar dependencias basicas..."
    apt-get install -y -qq \
        curl wget git ca-certificates gnupg \
        lsb-release apt-transport-https \
        software-properties-common \
        ufw python3                                         >> "$LOG" 2>&1
    info "Sistema actualizado com sucesso."
}

# -- PASSO 2: Instalar Docker CE ------------------------------------------------
step_install_docker() {
    step "PASSO 2/6: Instalar Docker CE"

    if command -v docker &>/dev/null; then
        info "Docker ja esta instalado: $(docker --version)"
        return 0
    fi

    info "A remover versoes antigas do Docker..."
    apt-get remove -y -qq \
        docker docker-engine docker.io containerd runc \
        2>/dev/null >> "$LOG" 2>&1 || true

    info "A configurar repositorio oficial Docker..."
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

    info "A instalar Docker CE..."
    apt-get update -qq                                      >> "$LOG" 2>&1
    apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin          >> "$LOG" 2>&1

    systemctl enable --now docker                           >> "$LOG" 2>&1
    info "Docker instalado: $(docker --version)"
}

# -- Configurar storage driver Docker para Proxmox LXC ------------------------
# Tenta overlay2 (rapido, preferido). Se o kernel bloquear com MS_PRIVATE
# (LXC sem nesting), reconfigura automaticamente para vfs (sempre funciona).
step_fix_lxc_overlay() {
    info "A configurar storage driver para Proxmox LXC..."

    # Parar Docker e limpar estado de tentativas anteriores
    systemctl stop docker docker.socket 2>/dev/null            >> "$LOG" 2>&1 || true
    systemctl stop containerd                                  >> "$LOG" 2>&1 || true
    sleep 3
    info "A limpar dados anteriores do Docker..."
    rm -rf /var/lib/docker/* /var/lib/containerd/*
    log "Dados anteriores removidos"

    # Remover daemon.json de tentativas anteriores para deixar Docker
    # usar overlay2 por omissao (funciona em LXC privilegiado com nesting=1)
    rm -f /etc/docker/daemon.json
    log "daemon.json removido -- Docker vai usar driver por omissao (overlay2)"

    # Iniciar Docker
    info "A iniciar Docker..."
    systemctl start containerd                                 >> "$LOG" 2>&1
    sleep 3
    systemctl start docker                                     >> "$LOG" 2>&1
    sleep 5

    local active_driver
    active_driver=$(docker info --format '{{.Driver}}' 2>/dev/null || echo "?")
    info "Storage driver activo: ${active_driver}"
    log "Storage driver inicial: ${active_driver}"

    # Testar se o Docker consegue mesmo arrancar um contentor
    # (hello-world ainda nao existe -- teste so faz sentido se ja estiver cached)
    # O teste real e feito em check_lxc_nesting e step_install_portainer
}

# -- Mostrar erro de nesting Proxmox e parar -----------------------------------
_fail_nesting() {
    local detail="${1:-}"
    log "ERRO nesting: ${detail}"

    echo "" >&2
    echo "======================================================================"  >&2
    echo "  ERRO: Docker nao pode arrancar contentores neste LXC"                 >&2
    echo "======================================================================"  >&2
    echo ""                                                                        >&2
    echo "  Causa: o LXC Proxmox nao tem a opcao 'nesting' activa."              >&2
    echo "  Sem ela, o Docker nao consegue correr NENHUM contentor."             >&2
    echo ""                                                                        >&2
    echo "  SOLUCAO -- executar NO HOST PROXMOX:"                                >&2
    echo ""                                                                        >&2
    echo "    1. Ver o ID deste LXC:"                                             >&2
    echo "         pct list"                                                       >&2
    echo ""                                                                        >&2
    echo "    2. Activar nesting (substituir XXX pelo ID do LXC):"               >&2
    echo "         pct set XXX --features nesting=1,keyctl=1"                     >&2
    echo ""                                                                        >&2
    echo "    3. Reiniciar o LXC:"                                                >&2
    echo "         pct stop XXX && pct start XXX"                                 >&2
    echo ""                                                                        >&2
    echo "    4. Voltar a executar o instalador dentro do LXC:"                  >&2
    echo "         bash install.sh"                                                >&2
    echo ""                                                                        >&2
    echo "  Alternativa (interface Proxmox):"                                     >&2
    echo "    Container > Options > Features > Nesting (activar checkmark)"       >&2
    echo ""                                                                        >&2

    whiptail \
        --backtitle "myLineage Installer  v2.1" \
        --title "Configuracao Proxmox Necessaria" \
        --msgbox \
"O Docker nao consegue correr contentores.

A opcao 'nesting' nao esta activa neste LXC.

SOLUCAO -- no HOST Proxmox:

  1. Ver o ID deste LXC:
       pct list

  2. Activar nesting (mudar XXX pelo ID):
       pct set XXX --features nesting=1,keyctl=1

  3. Reiniciar o LXC:
       pct stop XXX && pct start XXX

  4. Re-executar o instalador:
       bash install.sh

Alternativa (interface Proxmox):
  Container > Options > Features
  -> activar 'Nesting'" \
        26 64 \
        </dev/tty >/dev/tty 2>/dev/null || true

    exit 1
}

# -- PASSO 3: Instalar Portainer ------------------------------------------------
step_install_portainer() {
    step "PASSO 3/6: Instalar Portainer"

    # -- 1. Aguardar daemon Docker -----------------------------------------------
    info "A aguardar servico Docker ficar operacional..."
    local waited=0
    while ! docker info &>/dev/null; do
        sleep 2; waited=$((waited + 2))
        printf "\r  Aguardar... %ds" "$waited"
        if (( waited >= 60 )); then
            echo ""; log "ERRO: Docker nao disponivel apos 60s"; return 1
        fi
    done
    [[ $waited -gt 0 ]] && echo ""

    # -- 2. Verificar se o storage driver actual funciona -----------------------
    local cur_driver
    cur_driver=$(docker info --format '{{.Driver}}' 2>/dev/null || echo "?")
    info "Storage driver: ${cur_driver}"
    log "Storage driver em uso: ${cur_driver}"

    # -- 3. Verificar nesting: testar arranque de contentor real ----------------
    # Usa hello-world se ja estiver em cache; se nao estiver faz pull rapido.
    info "A verificar permissoes do LXC (nesting)..."
    local nest_err
    nest_err=$(docker run --rm --pull=never hello-world 2>&1) || true

    if echo "$nest_err" | grep -q "MS_PRIVATE\|remount-private"; then
        # MS_PRIVATE com overlay2 -> guardar driver actual, tentar vfs como fallback
        info "MS_PRIVATE detectado com driver ${cur_driver} -- a tentar fallback vfs..."
        log "MS_PRIVATE com driver=${cur_driver}: ${nest_err}"
        systemctl stop docker docker.socket containerd 2>/dev/null >> "$LOG" 2>&1 || true
        sleep 3
        rm -rf /var/lib/docker/* /var/lib/containerd/*
        mkdir -p /etc/docker
        printf '{\n  "storage-driver": "vfs"\n}\n' > /etc/docker/daemon.json
        systemctl start containerd >> "$LOG" 2>&1; sleep 3
        systemctl start docker     >> "$LOG" 2>&1; sleep 5
        cur_driver=$(docker info --format '{{.Driver}}' 2>/dev/null || echo "?")
        info "Storage driver apos fallback: ${cur_driver}"
        # Re-testar; se ainda falhar e MS_PRIVATE -> nesting mesmo nao activo
        nest_err=$(docker run --rm --pull=never hello-world 2>&1) || true
        if echo "$nest_err" | grep -q "MS_PRIVATE\|remount-private"; then
            _fail_nesting "$nest_err"
        fi
    fi

    if echo "$nest_err" | grep -qi "Unable to find image\|No such image"; then
        # Imagem nao em cache -- fazer pull e testar
        info "  (a descarregar imagem de teste...)"
        docker pull --quiet hello-world >> "$LOG" 2>&1 || true
        nest_err=$(docker run --rm hello-world 2>&1) || true
        if echo "$nest_err" | grep -q "MS_PRIVATE\|remount-private"; then
            _fail_nesting "$nest_err"
        fi
    fi
    info "LXC OK -- Docker pode correr contentores."

    # -- 4. Limpar artefactos de tentativas anteriores ---------------------------
    docker rm -f portainer 2>/dev/null >> "$LOG" 2>&1 || true
    docker volume rm portainer_data 2>/dev/null >> "$LOG" 2>&1 || true

    # -- 5. Descarregar imagem Portainer com progresso limpo ---------------------
    info "A descarregar imagem Portainer (pode demorar)..."
    local layers_total=0 layers_done=0
    while IFS= read -r line; do
        log "pull: $line"
        if echo "$line" | grep -q "Pull complete\|Already exists"; then
            layers_done=$(( layers_done + 1 ))
            printf "\r  Descarregado: %d camadas..." "$layers_done"
        elif echo "$line" | grep -q "Pulling from"; then
            printf "  --> %s\n" "$line"
        elif echo "$line" | grep -q "^Status:"; then
            echo ""; info "$line"
        fi
    done < <(docker pull portainer/portainer-ce:latest 2>&1)
    echo ""

    # -- 6. Criar volume e arrancar contentor ------------------------------------
    info "A criar volume de dados..."
    docker volume create portainer_data >> "$LOG" 2>&1

    info "A arrancar contentor Portainer..."
    local run_out
    run_out=$(docker run -d \
        --name portainer \
        --restart=always \
        --network host \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        portainer/portainer-ce:latest 2>&1)
    log "docker run: $run_out"

    if echo "$run_out" | grep -q "MS_PRIVATE\|remount-private\|permission denied"; then
        _fail_nesting "$run_out"
    fi

    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^portainer$"; then
        echo "  ERRO ao arrancar Portainer:" >&2
        echo "  $run_out" >&2
        log "ERRO: portainer nao esta em execucao. Output: $run_out"
        return 1
    fi

    info "Portainer a correr (HTTPS: https://<IP>:${PORTAINER_HTTPS_PORT})"
}

# -- PASSO 4: Clonar repositorio -----------------------------------------------
step_clone_repo() {
    step "PASSO 4/6: Descarregar myLineage do GitHub"

    # Garantir que o directorio de instalacao existe
    mkdir -p "$APP_DIR"

    if [[ -d "$APP_DIR/.git" ]]; then
        info "Repositorio ja existe -- a actualizar..."
        git -C "$APP_DIR" pull                              >> "$LOG" 2>&1
    else
        info "A clonar repositorio de ${REPO_URL}..."
        git clone "$REPO_URL" "$APP_DIR"                    >> "$LOG" 2>&1
    fi
    info "Repositorio disponivel em: $APP_DIR"
}

# -- PASSO 5: Verificar Dockerfile e gerar docker-compose.yml ------------------
step_create_dockerfile() {
    if [[ -f "$APP_DIR/Dockerfile" ]]; then
        info "Dockerfile ja presente no repositorio."
        return 0
    fi

    info "Dockerfile nao encontrado -- a criar versao de fallback..."
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
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/JSON-DATA ./JSON-DATA
RUN mkdir -p /app/uploads/fotos /app/uploads/documentos /app/uploads/gedcom
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000} > /dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
DOCKERFILE_CONTENT
    info "Dockerfile de fallback criado."
}

step_create_compose() {
    info "A gerar docker-compose.yml..."
    cat > "$APP_DIR/docker-compose.yml" << COMPOSE_CONTENT
# -----------------------------------------------------------------------------
#  myLineage -- docker-compose.yml
#  Gerado automaticamente pelo instalador em $(date)
# -----------------------------------------------------------------------------

services:

  mylineage:
    build:
      context: .
      dockerfile: Dockerfile
    image: mylineage:latest
    pull_policy: never
    container_name: mylineage
    restart: unless-stopped

    # network_mode: host evita criar um novo network namespace,
    # o que elimina o erro de sysctl em Proxmox LXC:
    #   "open sysctl net.ipv4.ip_unprivileged_port_start: permission denied"
    network_mode: host

    # Volumes de dados
    # Por omissao os dados ficam dentro do contentor.
    # Para persistir dados em pastas do servidor descomente as linhas
    # abaixo e ajuste os caminhos conforme necessario.
    # Depois reinicie com: docker compose up -d --build
    #
    # volumes:
    #   # Base de dados JSON (registos genealogicos -- IMPORTANTE: fazer backups)
    #   - /root/myLineage-data/JSON-DATA:/app/JSON-DATA
    #
    #   # Galeria de fotografias
    #   - /root/myLineage-data/fotos:/app/uploads/fotos
    #
    #   # Biblioteca de documentos
    #   - /root/myLineage-data/documentos:/app/uploads/documentos
    #
    #   # Ficheiros GEDCOM de importacao / exportacao
    #   - /root/myLineage-data/gedcom:/app/uploads/gedcom

    environment:
      - NODE_ENV=production
      - PORT=${APP_PORT}

    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:${APP_PORT}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    labels:
      - "com.mylineage.version=2.1"
      - "com.mylineage.install-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      - "com.mylineage.managed=true"
COMPOSE_CONTENT
    info "docker-compose.yml criado em $APP_DIR/docker-compose.yml"
}

# -- Configurar adminPhone nos dados iniciais ----------------------------------
step_seed_data() {
    info "A configurar administrador nos dados iniciais..."

    local settings="$APP_DIR/JSON-DATA/settings.json"

    if [[ ! -f "$settings" ]]; then
        echo '{"adminPhone":"'"$ADMIN_PHONE"'"}' > "$settings"
        log "settings.json criado com adminPhone=$ADMIN_PHONE"
    else
        python3 - <<PYEOF
import json
path = "$settings"
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {}
data['adminPhone'] = "$ADMIN_PHONE"
with open(path, 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
PYEOF
        log "settings.json actualizado: adminPhone=$ADMIN_PHONE"
    fi
    info "Administrador configurado: $ADMIN_PHONE"
}

# -- PASSO 5: Build e arranque -------------------------------------------------
step_build_and_start() {
    step "PASSO 5/6: Compilar imagem Docker e iniciar servicos"
    info "ATENCAO: A compilacao da imagem Docker pode demorar varios minutos."
    info "Aguarde -- o progresso do build e mostrado abaixo:"
    echo ""
    cd "$APP_DIR"
    docker compose build --no-cache
    echo ""
    info "Build concluido. A iniciar contentor..."
    docker compose up -d
    info "Contentor iniciado."
}

# -- PASSO 6: Aguardar servico -------------------------------------------------
wait_for_service() {
    step "PASSO 6/6: Verificar servico"
    info "A aguardar o myLineage iniciar..."
    local waited=0
    local max=90
    while ! curl -sf "http://localhost:${APP_PORT}" > /dev/null 2>&1; do
        sleep 3
        waited=$((waited + 3))
        printf "\r  A aguardar... %ds" "$waited"
        if (( waited >= max )); then
            echo ""
            info "AVISO: Servico nao disponivel apos ${max}s (pode ainda estar a iniciar)."
            return 0
        fi
    done
    echo ""
    info "Servico disponivel apos ${waited}s."
}

# -- Obter IP do servidor -------------------------------------------------------
get_server_ip() {
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
    [[ -z "$SERVER_IP" ]] && SERVER_IP="127.0.0.1"
}

# -- Ecra final ----------------------------------------------------------------
show_next_steps() {
    get_server_ip

    local SUMMARY="/root/mylineage-access.txt"

    # Escrever ficheiro de resumo linha a linha (sem heredoc -- mais robusto)
    printf '======================================================================\n'       > "$SUMMARY"
    printf '  myLineage -- RESUMO DE ACESSO\n'                                             >> "$SUMMARY"
    printf '  Instalado em: %s\n' "$(date)"                                                >> "$SUMMARY"
    printf '======================================================================\n'       >> "$SUMMARY"
    printf '\n'                                                                             >> "$SUMMARY"
    printf '  myLineage  -->  http://%s:%s\n'  "$SERVER_IP" "$APP_PORT"                   >> "$SUMMARY"
    printf '  Portainer  -->  https://%s:%s\n' "$SERVER_IP" "$PORTAINER_HTTPS_PORT"       >> "$SUMMARY"
    printf '\n'                                                                             >> "$SUMMARY"
    printf '  Administrador: %s\n' "$ADMIN_PHONE"                                         >> "$SUMMARY"
    printf '\n'                                                                             >> "$SUMMARY"
    printf '  PRIMEIRO LOGIN:\n'                                                           >> "$SUMMARY"
    printf '    1. Abra http://%s:%s no browser\n' "$SERVER_IP" "$APP_PORT"               >> "$SUMMARY"
    printf '    2. Introduza o numero de telemovel acima\n'                                >> "$SUMMARY"
    printf '    3. Leia o QR code com o Microsoft Authenticator\n'                        >> "$SUMMARY"
    printf '    4. Valide o codigo de 6 digitos\n'                                        >> "$SUMMARY"
    printf '\n'                                                                             >> "$SUMMARY"
    printf '  COMANDOS UTEIS:\n'                                                           >> "$SUMMARY"
    printf '    Ver logs:    docker logs mylineage -f\n'                                   >> "$SUMMARY"
    printf '    Parar:       docker compose -f %s/docker-compose.yml down\n' "$APP_DIR"   >> "$SUMMARY"
    printf '    Actualizar:  cd %s && git pull && docker compose up -d --build\n' "$APP_DIR" >> "$SUMMARY"
    printf '    Log install: %s\n' "$LOG"                                                  >> "$SUMMARY"
    printf '\n'                                                                             >> "$SUMMARY"
    printf '======================================================================\n'       >> "$SUMMARY"
    log "Resumo de acesso guardado em: ${SUMMARY}"

    # Imprimir no terminal
    printf '\n'
    printf '======================================================================\n'
    printf '  myLineage -- INSTALACAO CONCLUIDA!\n'
    printf '======================================================================\n'
    printf '\n'
    printf '  myLineage  -->  http://%s:%s\n'  "$SERVER_IP" "$APP_PORT"
    printf '  Portainer  -->  https://%s:%s\n' "$SERVER_IP" "$PORTAINER_HTTPS_PORT"
    printf '\n'
    printf '  Administrador: %s\n' "$ADMIN_PHONE"
    printf '\n'
    printf '  PRIMEIRO LOGIN:\n'
    printf '    1. Abra http://%s:%s no browser\n' "$SERVER_IP" "$APP_PORT"
    printf '    2. Introduza o numero de telemovel acima\n'
    printf '    3. Leia o QR code com o Microsoft Authenticator\n'
    printf '    4. Valide o codigo de 6 digitos\n'
    printf '\n'
    printf '  (Este resumo foi guardado em: %s)\n' "$SUMMARY"
    printf '\n'
    printf '======================================================================\n'
    printf '\n'
}

# ==============================================================================
#   PROGRAMA PRINCIPAL
# ==============================================================================

# Inicializar log
: > "$LOG"
log "myLineage Instalador v2.1 -- $(date)"
log "Repositorio: $REPO_URL"

# Verificar root
check_root

# Garantir que whiptail esta disponivel
ensure_whiptail

# Detectar SO
detect_os

# Ecra de boas-vindas
show_welcome

# Confirmacao
if ! confirm_install; then
    whiptail \
        --backtitle "myLineage Installer  v2.1" \
        --title "Instalacao Cancelada" \
        --msgbox "Instalacao cancelada pelo utilizador.

Pode re-executar o instalador a qualquer momento:
  sudo bash install.sh" \
        10 54
    exit 0
fi

# Recolher configuracoes (apenas porta e telemovel)
ask_config

log "Configuracao: APP_DIR=$APP_DIR  PORT=$APP_PORT  ADMIN_PHONE=$ADMIN_PHONE"

# -- Execucao com progresso no CLI ---------------------------------------------
echo ""
echo "======================================================================"
echo "  myLineage -- Instalacao em curso"
echo "  ATENCAO: Este processo e demorado. Por favor aguarde."
echo "======================================================================"
echo ""

# Activar tratamento de erros a partir daqui (whiptail ja garantido)
trap 'handle_error $LINENO' ERR

progress 5  "A actualizar o sistema operativo..."
step_update_system

progress 20 "A instalar Docker CE..."
step_install_docker

progress 32 "A configurar storage driver (Proxmox LXC)..."
step_fix_lxc_overlay

progress 36 "A verificar compatibilidade Docker/LXC..."
check_lxc_nesting

progress 38 "A instalar Portainer..."
step_install_portainer

progress 52 "A descarregar myLineage do GitHub..."
step_clone_repo

progress 62 "A preparar ficheiros de configuracao..."
step_create_dockerfile
step_create_compose
step_seed_data

progress 72 "A compilar imagem Docker (processo demorado)..."
step_build_and_start

progress 95 "A verificar servico..."
wait_for_service

progress 100 "Instalacao concluida!"
echo ""

# Ecra final
show_next_steps

log "=== Instalacao concluida em $(date) ==="
exit 0
