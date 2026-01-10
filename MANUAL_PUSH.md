# Manual Push to GitHub - Step by Step

If the automated scripts aren't working, follow these manual steps.

---

## Prerequisites

### 1. Get Your Token (ONLY the token!)

Go to: https://github.com/settings/tokens

Click "Generate new token (classic)"

Settings:
- Name: `website-cloner`
- Expiration: 90 days
- Scopes: ✅ **repo** (check ALL boxes under repo)

Click "Generate token"

**COPY THE TOKEN** - it looks like this:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Verify Repository Exists

Go to: https://github.com/davidbmar/website-cloner

If you get "404 Not Found":
1. Go to: https://github.com/new
2. Name: `website-cloner`
3. **Don't check any boxes**
4. Create repository

---

## Method 1: Direct Push (Easiest)

Replace `YOUR_TOKEN_HERE` with your actual token:

```bash
cd /home/ubuntu/src/website-cloner

git push https://YOUR_TOKEN_HERE@github.com/davidbmar/website-cloner.git main:main --set-upstream
```

**Example** (with fake token):
```bash
git push https://ghp_abc123def456@github.com/davidbmar/website-cloner.git main:main --set-upstream
```

If successful, set up tracking:
```bash
git branch --set-upstream-to=origin/main main
```

---

## Method 2: Use Credential Helper

```bash
cd /home/ubuntu/src/website-cloner

# Tell git to use credential helper
git config --global credential.helper store

# Push (will ask for credentials)
git push -u origin main
```

When prompted:
- **Username**: `davidbmar`
- **Password**: `YOUR_TOKEN_HERE` (paste your token)

---

## Method 3: Update Remote URL

```bash
cd /home/ubuntu/src/website-cloner

# Set remote with token (replace YOUR_TOKEN_HERE)
git remote set-url origin https://YOUR_TOKEN_HERE@github.com/davidbmar/website-cloner.git

# Push
git push -u origin main

# Remove token from URL after success (for security)
git remote set-url origin https://github.com/davidbmar/website-cloner.git
```

---

## Verify Success

After pushing, check:

1. Go to: https://github.com/davidbmar/website-cloner
2. You should see all your files
3. README.md should be displayed at the bottom

---

## Troubleshooting

### "Authentication failed"

**Cause**: Token is wrong or doesn't have permissions

**Fix**:
1. Check token has `repo` scope: https://github.com/settings/tokens
2. Create a new token if needed
3. Make sure you're pasting ONLY the token (starts with `ghp_`)

### "Repository not found"

**Cause**: Repository doesn't exist

**Fix**:
1. Create it at: https://github.com/new
2. Use exact name: `website-cloner`
3. Don't initialize with README

### "Could not resolve host"

**Cause**: Malformed URL (usually from pasting URL instead of token)

**Fix**:
1. Make sure you paste ONLY the token
2. Token format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. NOT the full URL like `https://github.com/...`

### "Permission denied"

**Cause**: You don't own the repository

**Fix**:
1. Make sure you're logged in as `davidbmar`
2. Verify you own the repository
3. Check token has write permissions

---

## Example: Complete Push Session

```bash
# 1. Go to token page and copy your token
# https://github.com/settings/tokens

# 2. Replace TOKEN_HERE with your actual token:
TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 3. Push directly
git push https://${TOKEN}@github.com/davidbmar/website-cloner.git main:main --set-upstream

# 4. If successful, you'll see:
# Enumerating objects: 20, done.
# Counting objects: 100% (20/20), done.
# ...
# To https://github.com/davidbmar/website-cloner.git
#  * [new branch]      main -> main

# 5. Set up tracking
git branch --set-upstream-to=origin/main main

# Done! ✓
```

---

## Security Note

After pushing successfully:

```bash
# Remove token from git config
git remote set-url origin https://github.com/davidbmar/website-cloner.git

# Clear credential helper
git config --global --unset credential.helper
```

---

## Still Not Working?

Try the automated script:

```bash
bash simple-push.sh
```

Or get help at: https://docs.github.com/en/authentication
