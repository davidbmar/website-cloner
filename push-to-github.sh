#!/bin/bash

# GitHub Push Helper Script
# Automates the process of pushing to GitHub

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║     Website Cloner - GitHub Push Helper     ║"
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

# Check if this is a git repository
if [ ! -d .git ]; then
    print_warning "Not a git repository yet"
    echo ""
    read -p "Initialize git repository now? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        bash init-git.sh
        if [ $? -ne 0 ]; then
            print_error "Failed to initialize git repository"
            exit 1
        fi
    else
        print_error "Cannot proceed without git repository"
        exit 1
    fi
fi

print_success "Git repository found"

# Check if remote origin exists
if git remote | grep -q "^origin$"; then
    EXISTING_REMOTE=$(git remote get-url origin)
    print_info "Remote 'origin' already exists: $EXISTING_REMOTE"
    echo ""
    read -p "Update remote URL? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        REMOVE_REMOTE=true
    else
        REMOVE_REMOTE=false
    fi
else
    REMOVE_REMOTE=false
fi

# Get repository URL from user
echo ""
echo "Please provide your GitHub repository URL"
echo "Examples:"
echo "  HTTPS: https://github.com/username/website-cloner.git"
echo "  SSH:   git@github.com:username/website-cloner.git"
echo ""
read -p "Repository URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    print_error "No URL provided"
    exit 1
fi

# Validate URL format
if [[ ! $REPO_URL =~ ^(https://github.com/|git@github.com:) ]]; then
    print_warning "URL doesn't look like a GitHub URL"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update or add remote
if [ "$REMOVE_REMOTE" = true ]; then
    print_info "Removing old remote..."
    git remote remove origin
fi

if ! git remote | grep -q "^origin$"; then
    print_info "Adding remote 'origin'..."
    git remote add origin "$REPO_URL"
    print_success "Remote added"
fi

# Verify remote
CURRENT_REMOTE=$(git remote get-url origin)
print_info "Remote URL: $CURRENT_REMOTE"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    print_warning "You have uncommitted changes"
    echo ""
    git status --short
    echo ""
    read -p "Commit these changes? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git add .
        read -p "Commit message: " COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="chore: update files before push"
        fi
        git commit -m "$COMMIT_MSG"
        print_success "Changes committed"
    fi
fi

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "Current branch is '$CURRENT_BRANCH', not 'main'"
    read -p "Rename to 'main'? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git branch -M main
        print_success "Renamed to 'main'"
    fi
fi

# Show what will be pushed
echo ""
print_info "Ready to push. Here's what will be uploaded:"
echo ""
git log --oneline --decorate -5
echo ""

# Confirm push
read -p "Push to GitHub? (Y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Nn]$ ]]; then
    print_info "Push cancelled"
    exit 0
fi

# Push to GitHub
print_info "Pushing to GitHub..."
echo ""

if git push -u origin main; then
    echo ""
    print_success "Successfully pushed to GitHub!"
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║              Success! 🎉                     ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""
    echo "Your repository is now live on GitHub!"
    echo ""

    # Extract owner and repo from URL
    if [[ $REPO_URL =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
        OWNER="${BASH_REMATCH[1]}"
        REPO="${BASH_REMATCH[2]}"
        REPO_WEB_URL="https://github.com/$OWNER/$REPO"
        echo "View it at: $REPO_WEB_URL"
        echo ""
        echo "Next steps:"
        echo "  1. Visit your repository: $REPO_WEB_URL"
        echo "  2. Add description and topics in repository settings"
        echo "  3. Share clone URL: git clone $REPO_URL"
    fi
else
    echo ""
    print_error "Push failed"
    echo ""
    echo "Common issues:"
    echo "  1. Authentication failed"
    echo "     - HTTPS: Use Personal Access Token, not password"
    echo "     - Create at: https://github.com/settings/tokens"
    echo "  2. Permission denied"
    echo "     - Verify you have write access to the repository"
    echo "  3. Repository doesn't exist"
    echo "     - Create it first at: https://github.com/new"
    echo ""
    echo "See GITHUB_SETUP.md for detailed troubleshooting"
    exit 1
fi
