#!/bin/bash
#
# Script de génération de rapport GoAccess pour magnyfc78.com
# Génère un rapport HTML à partir des logs Nginx
#

set -e

# Configuration
SITE_NAME="Magny FC 78"
LOG_FILE="/var/log/nginx/access.log"
OUTPUT_FILE="/var/www/magny-fc-78/public/stats.html"
GOACCESS_LOG="/var/www/magny-fc-78/logs/goaccess.log"
CONFIG_FILE="/etc/goaccess/goaccess.conf"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de log
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$GOACCESS_LOG"
}

# Vérification des prérequis
check_prerequisites() {
    # Vérifier si GoAccess est installé
    if ! command -v goaccess &> /dev/null; then
        log "ERROR" "${RED}GoAccess n'est pas installé. Installez-le avec: sudo apt install goaccess${NC}"
        exit 1
    fi

    # Vérifier si le fichier de log existe
    if [ ! -f "$LOG_FILE" ]; then
        log "ERROR" "${RED}Le fichier de log Nginx n'existe pas: $LOG_FILE${NC}"
        exit 1
    fi

    # Créer le répertoire de sortie si nécessaire
    OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
    if [ ! -d "$OUTPUT_DIR" ]; then
        log "INFO" "Création du répertoire de sortie: $OUTPUT_DIR"
        mkdir -p "$OUTPUT_DIR"
    fi

    # Créer le répertoire de logs si nécessaire
    LOG_DIR=$(dirname "$GOACCESS_LOG")
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
    fi
}

# Génération du rapport
generate_report() {
    log "INFO" "${GREEN}Début de la génération du rapport GoAccess...${NC}"

    # Options GoAccess
    local goaccess_opts=(
        --log-format=COMBINED
        --date-format='%d/%b/%Y'
        --time-format='%H:%M:%S'
        --html-report-title="$SITE_NAME - Statistiques de visite"
        --html-prefs='{"theme":"bright","perPage":20,"layout":"horizontal"}'
        --anonymize-ip
        --ignore-crawlers
        --real-os
        --browsers-file=/usr/share/goaccess/browsers.list
    )

    # Ajouter la config personnalisée si elle existe
    if [ -f "$CONFIG_FILE" ]; then
        goaccess_opts+=(--config-file="$CONFIG_FILE")
    fi

    # Générer le rapport HTML
    goaccess "$LOG_FILE" \
        "${goaccess_opts[@]}" \
        -o "$OUTPUT_FILE" \
        2>> "$GOACCESS_LOG"

    if [ $? -eq 0 ]; then
        log "INFO" "${GREEN}Rapport généré avec succès: $OUTPUT_FILE${NC}"

        # Afficher la taille du rapport
        local size=$(du -h "$OUTPUT_FILE" | cut -f1)
        log "INFO" "Taille du rapport: $size"
    else
        log "ERROR" "${RED}Erreur lors de la génération du rapport${NC}"
        exit 1
    fi
}

# Nettoyage des anciens logs (optionnel)
cleanup_logs() {
    # Garde les 30 derniers jours de logs GoAccess
    if [ -f "$GOACCESS_LOG" ]; then
        local log_size=$(du -m "$GOACCESS_LOG" 2>/dev/null | cut -f1)
        if [ "$log_size" -gt 10 ]; then
            log "INFO" "Rotation du fichier de log GoAccess (taille: ${log_size}MB)"
            tail -n 1000 "$GOACCESS_LOG" > "${GOACCESS_LOG}.tmp"
            mv "${GOACCESS_LOG}.tmp" "$GOACCESS_LOG"
        fi
    fi
}

# Mode temps réel (WebSocket)
start_realtime() {
    log "INFO" "${YELLOW}Démarrage du mode temps réel sur le port 7890...${NC}"

    goaccess "$LOG_FILE" \
        --log-format=COMBINED \
        --date-format='%d/%b/%Y' \
        --time-format='%H:%M:%S' \
        --html-report-title="$SITE_NAME - Statistiques en temps réel" \
        --real-time-html \
        --ws-url=wss://magnyfc78.com:7890 \
        --port=7890 \
        --anonymize-ip \
        --ignore-crawlers \
        -o "$OUTPUT_FILE" \
        >> "$GOACCESS_LOG" 2>&1 &

    echo $! > /var/run/goaccess.pid
    log "INFO" "GoAccess temps réel démarré (PID: $(cat /var/run/goaccess.pid))"
}

# Arrêt du mode temps réel
stop_realtime() {
    if [ -f /var/run/goaccess.pid ]; then
        local pid=$(cat /var/run/goaccess.pid)
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm /var/run/goaccess.pid
            log "INFO" "GoAccess temps réel arrêté"
        fi
    else
        log "WARN" "Aucun processus GoAccess temps réel en cours"
    fi
}

# Affichage de l'aide
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  --generate, -g     Générer le rapport HTML (défaut)"
    echo "  --realtime, -r     Démarrer le mode temps réel"
    echo "  --stop, -s         Arrêter le mode temps réel"
    echo "  --help, -h         Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0                 Générer le rapport"
    echo "  $0 --realtime      Démarrer le mode temps réel"
    echo "  $0 --stop          Arrêter le mode temps réel"
}

# Point d'entrée principal
main() {
    check_prerequisites
    cleanup_logs

    case "${1:-}" in
        --realtime|-r)
            start_realtime
            ;;
        --stop|-s)
            stop_realtime
            ;;
        --help|-h)
            show_help
            ;;
        --generate|-g|"")
            generate_report
            ;;
        *)
            log "ERROR" "Option non reconnue: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
