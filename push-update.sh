#!/bin/bash
# Quick push for updates - just paste your token when prompted

echo "Quick Push Helper"
echo ""
read -sp "Paste your GitHub token: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo "No token provided"
    exit 1
fi

git push https://${TOKEN}@github.com/davidbmar/website-cloner.git main

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Push successful!"
else
    echo ""
    echo "✗ Push failed"
fi
