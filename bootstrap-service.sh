#!/bin/bash
set -euo pipefail

# Website Cloner Bootstrap Service Script
# Sets up systemd service and nginx configuration for the website cloner application
# NOTE: Run setup.sh first to install npm dependencies

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[WEBSITE-CLONER]${NC} $1"
}

error() {
    echo -e "${RED}[WEBSITE-CLONER ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WEBSITE-CLONER WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[WEBSITE-CLONER INFO]${NC} $1"
}

check_dependencies() {
    log "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js first."
    fi

    if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
        warn "node_modules not found. Running setup.sh first..."
        if [ -f "$SCRIPT_DIR/setup.sh" ]; then
            bash "$SCRIPT_DIR/setup.sh"
        else
            error "setup.sh not found. Please run npm install manually."
        fi
    fi

    NODE_VERSION=$(node --version)
    info "Node.js version: $NODE_VERSION"
}

install_systemd_service() {
    log "Installing systemd service..."

    if [ ! -f "$SCRIPT_DIR/systemd/website-cloner.service.template" ]; then
        error "Service template not found at $SCRIPT_DIR/systemd/website-cloner.service.template"
    fi

    # Replace template variables
    sed "s|{{WORKING_DIRECTORY}}|$SCRIPT_DIR|g" \
        "$SCRIPT_DIR/systemd/website-cloner.service.template" | \
        sudo tee /etc/systemd/system/website-cloner.service > /dev/null

    sudo systemctl daemon-reload
    sudo systemctl enable website-cloner

    log "Systemd service installed"
}

install_nginx_configs() {
    log "Installing nginx configurations..."

    # Check if nginx include directories exist
    if [ ! -d "/etc/nginx/conf.d/system-upstreams" ]; then
        error "Nginx include directory not found. Run auth gateway bootstrap first."
    fi

    # Copy upstream config
    sudo cp "$SCRIPT_DIR/nginx/upstream.conf" \
        /etc/nginx/conf.d/system-upstreams/website-cloner.conf

    # Copy routes config
    sudo cp "$SCRIPT_DIR/nginx/routes.conf" \
        /etc/nginx/conf.d/routes/website-cloner.conf

    log "Nginx configurations installed"
}

create_directories() {
    log "Creating required directories..."

    # Create output and logs directories if they don't exist
    mkdir -p "$SCRIPT_DIR/output"
    mkdir -p "$SCRIPT_DIR/logs"

    log "Directories created"
}

start_service() {
    log "Starting website-cloner service..."

    sudo systemctl restart website-cloner

    # Wait a moment for service to start
    sleep 2

    if systemctl is-active --quiet website-cloner; then
        log "Website-cloner service started successfully"
    else
        error "Failed to start website-cloner service. Check logs with: sudo journalctl -u website-cloner -n 50"
    fi
}

verify_installation() {
    log "Verifying installation..."

    # Check if service is running
    if ! systemctl is-active --quiet website-cloner; then
        error "website-cloner service is not running"
    fi

    # Check if app is responding
    if curl -s http://localhost:3000/ > /dev/null; then
        log "Website-cloner is responding on port 3000"
    else
        warn "Website-cloner is not responding on port 3000"
    fi

    log "Verification complete"
}

main() {
    log "Starting website-cloner service bootstrap..."

    check_dependencies
    create_directories
    install_systemd_service
    install_nginx_configs
    start_service
    verify_installation

    log "Website-cloner service bootstrap complete!"
    info ""
    info "Service status: sudo systemctl status website-cloner"
    info "View logs: sudo journalctl -u website-cloner -f"
    info "Access at: https://$(hostname -I | awk '{print $1}')/cloner/"
    info ""
    info "Note: Make sure you've run setup.sh to install npm dependencies"
}

main "$@"
