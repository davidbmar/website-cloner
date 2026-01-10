#!/bin/bash

# Website Cloner - Setup Script
# This script installs all dependencies and prepares the environment

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════╗"
echo "║     Website Cloner - Setup & Installation    ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Node.js is installed
print_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
print_success "Node.js found: $NODE_VERSION"

# Check if npm is installed
print_info "Checking npm installation..."
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

NPM_VERSION=$(npm -v)
print_success "npm found: v$NPM_VERSION"

# Install dependencies
print_info "Installing npm dependencies..."
npm install

if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create necessary directories
print_info "Creating output directories..."
mkdir -p output
mkdir -p logs
print_success "Directories created"

# Make CLI executable
print_info "Making CLI executable..."
chmod +x clone-website.js
print_success "CLI is now executable"

# Create example config if it doesn't exist
if [ ! -f "my-config.json" ]; then
    print_info "Creating example configuration..."
    cp config.example.json my-config.json
    print_warning "Edit my-config.json with your target URL before running"
fi

# Verify installation
print_info "Verifying installation..."
if node clone-website.js --help &> /dev/null; then
    print_success "Installation verified successfully"
else
    print_error "Installation verification failed"
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║          Setup Complete! 🎉                  ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Edit my-config.json with your target URL"
echo "  2. Run: node clone-website.js --config=my-config.json --enumerate"
echo "  3. Review output/manifest.json"
echo ""
echo "For more information, see README.md"
echo ""
