#!/bin/bash

# Project Status Script
# Shows implementation status and next steps

echo "╔═══════════════════════════════════════════════╗"
echo "║     Website Cloner - Implementation Status  ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

print_done() {
    echo -e "${GREEN}✓${NC} $1"
}

print_todo() {
    echo -e "${RED}○${NC} $1"
}

print_progress() {
    echo -e "${YELLOW}◐${NC} $1"
}

print_section() {
    echo ""
    echo -e "${BLUE}▌${NC} ${BLUE}$1${NC}"
    echo -e "${GRAY}  ────────────────────────────────────${NC}"
}

# Project Info
echo -e "${BLUE}Project:${NC} Website Cloner"
echo -e "${BLUE}Version:${NC} 0.1.0"
echo -e "${BLUE}Status:${NC}  Phase 2 Complete, Phase 3 Pending"

# Core Features
print_section "Core Features"
print_done "Project structure with organized directories"
print_done "Configuration system (config.example.json)"
print_done "CLI interface with commander.js"
print_done "Color-coded logging system"
print_done "URL utilities (normalization, validation)"
print_done "BFS enumeration engine (Phase 2)"
print_done "Rate limiting with token bucket"
print_done "Robots.txt support"
print_done "Pattern matching (ignore/allow)"
print_done "Manifest generation"
print_todo "Asset downloader (Phase 3)"
print_todo "Link rewriter for static hosting"
print_todo "Dynamic content detector"
print_todo "S3 uploader with website hosting"

# Library Files
print_section "Library Files (lib/)"
print_done "lib/logger.js - Logging utilities"
print_done "lib/url-utils.js - URL manipulation"
print_done "lib/enumerator.js - BFS crawling"
print_todo "lib/downloader.js - Asset downloads"
print_todo "lib/link-rewriter.js - URL rewriting"
print_todo "lib/dynamic-detector.js - Dynamic detection"
print_todo "lib/s3-uploader.js - S3 deployment"

# Scripts
print_section "Scripts"
print_done "setup.sh - Automated installation"
print_done "verify.sh - Installation verification"
print_done "init-git.sh - Git repository setup"
print_done "status.sh - Project status (this script)"

# Documentation
print_section "Documentation"
print_done "README.md - User guide"
print_done "CHANGELOG.md - Version history"
print_done "CONTRIBUTING.md - Development guide"
print_done "docs/IMPLEMENTATION_PLAN.md - Technical plan"
print_done ".gitignore - Git exclusions"

# Testing
print_section "Testing"
print_done "Manual testing with example.com"
print_done "Verification script (verify.sh)"
print_todo "Unit tests for utilities"
print_todo "Integration tests for crawling"
print_todo "End-to-end tests with mock servers"

# Phase Status
print_section "Implementation Phases"
print_done "Phase 1: Project Setup & Infrastructure"
print_done "Phase 2: URL Enumeration (Map Stage)"
print_todo "Phase 3: Asset Extraction (Clone Stage)"
print_todo "Phase 4: Link Rewriting"
print_todo "Phase 5: Dynamic Detection"
print_todo "Phase 6: S3 Deployment"
print_todo "Phase 7: Testing & Polish"

# Statistics
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║              Statistics                      ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Count files
LIB_FILES=$(find lib -name "*.js" 2>/dev/null | wc -l)
TOTAL_FILES=$(find . -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.sh" | grep -v node_modules | wc -l)
DOCS=$(find . -name "*.md" | wc -l)

echo -e "${BLUE}Library files:${NC}      $LIB_FILES"
echo -e "${BLUE}Total files:${NC}        $TOTAL_FILES"
echo -e "${BLUE}Documentation:${NC}      $DOCS markdown files"

if [ -d "node_modules" ]; then
    DEPS=$(ls node_modules | wc -l)
    echo -e "${BLUE}Dependencies:${NC}       $DEPS packages"
fi

if [ -d ".git" ]; then
    COMMITS=$(git rev-list --count HEAD 2>/dev/null || echo "0")
    echo -e "${BLUE}Git commits:${NC}        $COMMITS"
fi

# Next Steps
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║              Next Steps                      ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "Priority tasks for v0.2.0:"
echo ""
echo "1. Implement lib/downloader.js"
echo "   - Read manifest.json"
echo "   - Download HTML for each URL"
echo "   - Extract and download assets (CSS, JS, images)"
echo "   - Save with proper directory structure"
echo ""
echo "2. Implement lib/link-rewriter.js"
echo "   - Rewrite HTML <a>, <link>, <script>, <img> tags"
echo "   - Rewrite CSS url() and @import"
echo "   - Convert absolute URLs to relative paths"
echo ""
echo "3. Implement lib/dynamic-detector.js"
echo "   - Detect API calls (fetch, XHR)"
echo "   - Detect forms requiring backend"
echo "   - Detect WebSockets"
echo "   - Mark with data-marker attributes"
echo ""
echo "4. Implement lib/s3-uploader.js"
echo "   - S3 bucket configuration"
echo "   - Website hosting setup"
echo "   - File upload with correct Content-Type"
echo ""
echo "5. Integration & Testing"
echo "   - Test with multi-page websites"
echo "   - End-to-end verification"
echo "   - Update documentation"
echo ""
echo "Run ${GREEN}node clone-website.js --help${NC} to see available commands"
echo ""
