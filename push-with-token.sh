#!/bin/bash
# Helper script to push with a token securely

echo "╔═══════════════════════════════════════════════╗"
echo "║        GitHub Push Helper                    ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "IMPORTANT: Only paste the TOKEN, not the full URL!"
echo "The token should look like: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo ""

# Read token securely
read -sp "Enter ONLY your GitHub Personal Access Token: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo "Error: No token provided"
    exit 1
fi

# Clean token (remove any https:// prefix if user pasted URL)
TOKEN=$(echo "$TOKEN" | sed 's|https://||g' | sed 's|@github.com.*||g')

# Validate token format
if [[ ! $TOKEN =~ ^ghp_ ]]; then
    echo ""
    echo "⚠️  Warning: Token doesn't start with 'ghp_'"
    echo "   Make sure you pasted ONLY the token, not the full URL"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Set remote URL with token
git remote set-url origin https://${TOKEN}@github.com/davidbmar/website-cloner.git

# Push
echo "Pushing to GitHub..."
GIT_TERMINAL_PROMPT=0 git push --set-upstream origin main

if [ $? -eq 0 ]; then
    echo "✓ Successfully pushed to GitHub!"

    # Remove token from URL for security
    git remote set-url origin https://github.com/davidbmar/website-cloner.git
    echo "✓ Removed token from git config for security"
else
    echo "✗ Push failed"
    echo ""
    echo "Common issues:"
    echo "  1. Token doesn't have 'repo' scope"
    echo "  2. Repository doesn't exist on GitHub"
    echo "  3. Token is invalid/expired"
    exit 1
fi
