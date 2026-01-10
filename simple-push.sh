#!/bin/bash
# Simplest push method - manually paste token

echo "╔═══════════════════════════════════════════════╗"
echo "║        Simple GitHub Push                    ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "This script will guide you through pushing step-by-step."
echo ""

# Check if repository exists on GitHub
echo "Step 1: Verify your repository exists"
echo "----------------------------------------"
echo "Go to: https://github.com/davidbmar/website-cloner"
echo ""
read -p "Does the repository exist? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please create it first:"
    echo "  1. Go to: https://github.com/new"
    echo "  2. Repository name: website-cloner"
    echo "  3. Don't check any boxes"
    echo "  4. Click 'Create repository'"
    echo ""
    exit 1
fi

# Get token
echo ""
echo "Step 2: Get your Personal Access Token"
echo "----------------------------------------"
echo "The token should look like: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo ""
echo "If you don't have one:"
echo "  1. Go to: https://github.com/settings/tokens"
echo "  2. Generate new token (classic)"
echo "  3. Check 'repo' scope"
echo "  4. Copy the token"
echo ""

# Read token
read -p "Paste your token here: " TOKEN

if [ -z "$TOKEN" ]; then
    echo "Error: No token provided"
    exit 1
fi

# Clean up any accidental extra text
TOKEN=$(echo "$TOKEN" | xargs)

# Show what we'll do
echo ""
echo "Step 3: Push to GitHub"
echo "----------------------------------------"
echo "Repository: davidbmar/website-cloner"
echo "Branch: main"
echo ""
read -p "Ready to push? (Y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Push cancelled"
    exit 0
fi

# Clean remote first
git remote set-url origin https://github.com/davidbmar/website-cloner.git

# Try push with token in URL (most reliable method)
echo ""
echo "Attempting push..."
git push https://${TOKEN}@github.com/davidbmar/website-cloner.git main:main --set-upstream

if [ $? -eq 0 ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║            SUCCESS! 🎉                       ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""
    echo "✓ Your code is now on GitHub!"
    echo ""
    echo "View it at: https://github.com/davidbmar/website-cloner"
    echo ""

    # Set up tracking for future pushes
    git branch --set-upstream-to=origin/main main

else
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║            PUSH FAILED                       ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""
    echo "Common reasons:"
    echo "  1. Token is invalid or expired"
    echo "  2. Token doesn't have 'repo' scope"
    echo "  3. Repository doesn't exist"
    echo "  4. You don't have write permission"
    echo ""
    echo "Try these steps:"
    echo "  1. Create a NEW token at: https://github.com/settings/tokens"
    echo "  2. Make sure to check 'repo' scope"
    echo "  3. Verify repository exists: https://github.com/davidbmar/website-cloner"
    echo ""
    exit 1
fi
