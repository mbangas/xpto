#!/usr/bin/env bash
# ===============================================================================
#
#   myLineage  --  Script de Actualizacao  v2.1
#
#   Actualiza o myLineage para a versao mais recente do GitHub.
#   Parte do principio que Docker e todos os componentes ja estao instalados.
#
#   Uso:
#       bash update.sh            (como root ou com sudo)
#       sudo bash update.sh
#
#   Ou, se instalado pelo instalador:
#       mylineage-update
#
# ===============================================================================

set -euo pipefail

APP_DIR="/root/myLineage"
LOG="/tmp/mylineage_update_$(date +%Y%m%d_%H%M%S).log"

# -- Utilitarios ---------------------------------------------------------------
info() { echo "  --> $*"; echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }
log()  { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG"; }

handle_error() {
    trap '' ERR
    local _ec=$?
    echo "" >&2
    echo "======================================================================" >&2
    echo "  ERRO DURANTE A ACTUALIZACAO" >&2
    echo "======================================================================" >&2
    echo "  Linha  : ${1:-?}" >&2
    echo "  Codigo : ${_ec}" >&2
    echo "  Log    : ${LOG}" >&2
    echo "" >&2
    tail -10 "${LOG}" 2>/dev/null | sed 's/^/    /' >&2 || true
    echo "" >&2
    exit "${_ec}"
}

# -- Verificar root ------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    echo ""
    echo "  ERRO: Execute como root ou com sudo"
    echo "  sudo bash update.sh"
    echo ""
    exit 1
fi

trap 'handle_error $LINENO' ERR
: > "$LOG"
log "mylineage-update iniciado em $(date)"

echo ""
echo "======================================================================"
echo "  myLineage -- Actualizacao"
echo "======================================================================"
echo ""

# -- Verificar Docker ----------------------------------------------------------
info "A verificar Docker..."
if ! command -v docker &>/dev/null; then
    echo "  ERRO: Docker nao esta instalado. Execute o instalador: bash install.sh"
    exit 1
fi
if ! systemctl is-active --quiet docker; then
    info "A iniciar Docker..."
    systemctl start docker
    sleep 3
fi
log "Docker activo"

# -- Verificar directorio ------------------------------------------------------
if [[ ! -d "$APP_DIR" ]]; then
    echo ""
    echo "  ERRO: Directorio $APP_DIR nao encontrado."
    echo "  Por favor re-instale com: bash install.sh"
    echo ""
    exit 1
fi
cd "$APP_DIR"

# -- Mostrar versao actual ------------------------------------------------------
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "desconhecida")
info "Versao actual: commit ${CURRENT_COMMIT}"

# -- Descarregar actualizacoes -------------------------------------------------
info "A descarregar actualizacoes do GitHub..."
git fetch --quiet >> "$LOG" 2>&1

UPDATES=$(git log HEAD..origin/main --oneline 2>/dev/null | wc -l | tr -d ' ')
if [[ "$UPDATES" == "0" ]]; then
    echo ""
    echo "  Ja esta na versao mais recente (commit ${CURRENT_COMMIT})."
    echo ""
    trap '' ERR
    exit 0
fi

info "${UPDATES} commit(s) novo(s) disponiveis. A actualizar..."
git pull --ff-only >> "$LOG" 2>&1
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
log "Actualizado de ${CURRENT_COMMIT} para ${NEW_COMMIT}"

# -- Detectar porta configurada ------------------------------------------------
APP_PORT=$(grep -oP '(?<=PORT=)\d+' "$APP_DIR/docker-compose.yml" 2>/dev/null | head -1 || true)
APP_PORT=${APP_PORT:-3000}

# -- Compilar nova imagem ------------------------------------------------------
info "A compilar nova imagem Docker (pode demorar alguns minutos)..."
docker compose build --no-cache >> "$LOG" 2>&1
log "Build concluido"

# -- Reiniciar contentor -------------------------------------------------------
info "A reiniciar contentor com a nova imagem..."
docker compose up -d >> "$LOG" 2>&1
log "Contentor reiniciado"

# -- Aguardar servico ----------------------------------------------------------
info "A aguardar o servico iniciar..."
waited=0
while ! curl -sf "http://localhost:${APP_PORT}" > /dev/null 2>&1; do
    sleep 3
    waited=$((waited + 3))
    printf "\r  A aguardar... %ds" "$waited"
    if (( waited >= 90 )); then
        echo ""
        info "AVISO: Servico ainda nao disponivel. Verifique com: docker logs mylineage -f"
        break
    fi
done
echo ""
info "Servico disponivel apos ${waited}s."

# -- Desactivar trap e mostrar resultado ---------------------------------------
trap '' ERR

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[[ -z "$SERVER_IP" ]] && SERVER_IP="127.0.0.1"

# Actualizar ficheiro de resumo de acesso
SUMMARY="/root/mylineage-access.txt"
if [[ -f "$SUMMARY" ]]; then
    sed -i "s|Instalado em:.*|Actualizado em: $(date)|" "$SUMMARY" 2>/dev/null || true
fi

printf '\n'
printf '======================================================================\n'
printf '  myLineage -- Actualizacao concluida!\n'
printf '======================================================================\n'
printf '\n'
printf '  Versao anterior: %s\n' "$CURRENT_COMMIT"
printf '  Versao actual:   %s\n' "$NEW_COMMIT"
printf '\n'
printf '  myLineage  -->  http://%s:%s\n' "$SERVER_IP" "$APP_PORT"
printf '\n'
printf '  Log completo: %s\n' "$LOG"
printf '\n'
printf '======================================================================\n'
printf '\n'

log "=== Actualizacao concluida em $(date) ==="
exit 0
