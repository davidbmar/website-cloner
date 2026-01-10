#!/bin/bash

# Git Repository Initialization Script
# Sets up the repository with proper initial commit

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║     Website Cloner - Git Initialization     ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi

print_success "Git is installed"

# Check if already a git repository
if [ -d .git ]; then
    print_warning "Already a git repository"
    echo ""
    read -p "Reinitialize? This will reset the repository. (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Aborted"
        exit 0
    fi
    rm -rf .git
fi

# Initialize git repository
print_info "Initializing git repository..."
git init
print_success "Repository initialized"

# Create .gitattributes for consistent line endings
cat > .gitattributes << 'EOF'
# Auto detect text files and normalize line endings to LF
* text=auto

# Shell scripts
*.sh text eol=lf

# JavaScript
*.js text eol=lf
*.json text eol=lf

# Documentation
*.md text eol=lf

# Images (binary)
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
EOF

print_success "Created .gitattributes"

# Add all files
print_info "Adding files to staging..."
git add .

# Show what will be committed
echo ""
print_info "Files to be committed:"
git status --short

# Create initial commit
echo ""
read -p "Create initial commit? (Y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Nn]$ ]]; then
    print_info "Skipping commit. Files are staged and ready."
    exit 0
fi

print_info "Creating initial commit..."
git commit -m "feat: initial commit - Phase 2 (URL enumeration) complete

- Project structure with lib/, docs/, output/, logs/
- BFS URL enumerator with rate limiting and robots.txt support
- CLI interface with --enumerate, --download, --full options
- Logging system with file and console output
- URL utilities for normalization and validation
- Configuration system with comprehensive schema
- Setup and verification scripts
- Documentation: README, CHANGELOG, CONTRIBUTING, IMPLEMENTATION_PLAN

Phase 2 (enumeration) is fully functional and tested.
Phase 3 (download) is planned but not yet implemented.

See CHANGELOG.md for detailed changes."

print_success "Initial commit created"

# Show log
echo ""
print_info "Commit details:"
git log --oneline --decorate -1

# Next steps
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║              Next Steps                      ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "1. Add remote repository:"
echo "   git remote add origin <repository-url>"
echo ""
echo "2. Push to GitHub:"
echo "   git push -u origin main"
echo ""
echo "3. Create development branch:"
echo "   git checkout -b develop"
echo ""
print_success "Git repository ready!"
