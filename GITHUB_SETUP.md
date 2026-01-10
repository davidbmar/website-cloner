# Adding Website Cloner to GitHub

Step-by-step guide to push this project to GitHub.

---

## Prerequisites

- GitHub account (create at https://github.com if you don't have one)
- Git installed locally (verify with `git --version`)
- SSH key or Personal Access Token for authentication

---

## Step 1: Create GitHub Repository

### Option A: Via GitHub Website (Recommended for first-timers)

1. Go to https://github.com/new
2. Fill in repository details:
   - **Repository name**: `website-cloner`
   - **Description**: `A two-phase website cloning tool with BFS enumeration and S3 deployment`
   - **Visibility**: Choose **Public** or **Private**
   - **DO NOT** check "Initialize with README" (we have one already)
   - **DO NOT** add .gitignore or license (we have them already)
3. Click **"Create repository"**
4. **Save the repository URL** shown on the next page:
   - HTTPS: `https://github.com/YOUR-USERNAME/website-cloner.git`
   - SSH: `git@github.com:YOUR-USERNAME/website-cloner.git`

### Option B: Via GitHub CLI (if installed)

```bash
gh repo create website-cloner \
  --public \
  --description "A two-phase website cloning tool with BFS enumeration and S3 deployment" \
  --source=.
```

---

## Step 2: Configure Git (First Time Only)

If this is your first time using git on this machine:

```bash
# Set your name (will appear in commits)
git config --global user.name "Your Name"

# Set your email (use your GitHub email)
git config --global user.email "your.email@example.com"

# Verify settings
git config --list
```

---

## Step 3: Initialize Local Git Repository

From the project directory:

```bash
cd /home/ubuntu/src/website-cloner

# Run the initialization script
bash init-git.sh
```

This will:
- Initialize git repository
- Create .gitattributes for line endings
- Stage all files
- Create initial commit with proper message
- Show you what was committed

**Press 'Y' when prompted to create the initial commit.**

---

## Step 4: Connect to GitHub

Add your GitHub repository as the remote:

### If using HTTPS:

```bash
git remote add origin https://github.com/YOUR-USERNAME/website-cloner.git
```

### If using SSH:

```bash
git remote add origin git@github.com:YOUR-USERNAME/website-cloner.git
```

**Replace `YOUR-USERNAME` with your actual GitHub username!**

Verify the remote was added:

```bash
git remote -v
```

You should see:
```
origin  https://github.com/YOUR-USERNAME/website-cloner.git (fetch)
origin  https://github.com/YOUR-USERNAME/website-cloner.git (push)
```

---

## Step 5: Push to GitHub

### Set default branch name to 'main':

```bash
git branch -M main
```

### Push your code:

```bash
git push -u origin main
```

**Authentication:**
- **HTTPS**: You'll be prompted for username and password/token
  - Username: Your GitHub username
  - Password: Use a Personal Access Token (NOT your GitHub password)
  - Create token at: https://github.com/settings/tokens
  - Required scopes: `repo` (full control)

- **SSH**: Works automatically if you have SSH keys set up
  - Setup guide: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### Expected Output:

```
Enumerating objects: 18, done.
Counting objects: 100% (18/18), done.
Delta compression using up to 4 threads
Compressing objects: 100% (15/15), done.
Writing objects: 100% (18/18), 25.43 KiB | 3.63 MiB/s, done.
Total 18 (delta 2), reused 0 (delta 0)
To https://github.com/YOUR-USERNAME/website-cloner.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

---

## Step 6: Verify on GitHub

1. Go to: `https://github.com/YOUR-USERNAME/website-cloner`
2. You should see:
   - All project files
   - README.md displayed at the bottom
   - 1 commit in history
   - Files organized in directories

---

## Step 7: Add Repository Details (Optional but Recommended)

On your GitHub repository page:

1. Click **"About"** (⚙️ icon on right side)
2. Add:
   - **Description**: `A two-phase website cloning tool with BFS enumeration and S3 deployment`
   - **Website**: Your documentation URL (if any)
   - **Topics/Tags**: `nodejs`, `web-scraper`, `website-cloner`, `s3`, `aws`, `bfs`, `crawler`
3. Save changes

---

## Step 8: Update README with Repository Links (Optional)

Edit README.md to add badges and links:

```bash
# At the top of README.md, add:
# Website Cloner

[![GitHub release](https://img.shields.io/github/v/release/YOUR-USERNAME/website-cloner)](https://github.com/YOUR-USERNAME/website-cloner/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Installation](#installation) | [Quick Start](#quick-start) | [Documentation](docs/IMPLEMENTATION_PLAN.md)
```

Commit and push the change:

```bash
git add README.md
git commit -m "docs: add repository badges and links"
git push
```

---

## Quick Reference: Common Git Commands

### After making changes:

```bash
# See what changed
git status

# See differences
git diff

# Stage specific files
git add file1.js file2.js

# Stage all changes
git add .

# Commit with message
git commit -m "feat: add new feature"

# Push to GitHub
git push
```

### Check status:

```bash
# Show current branch and status
git status

# Show commit history
git log --oneline

# Show remote repository
git remote -v
```

---

## Troubleshooting

### Problem: Authentication Failed (HTTPS)

**Solution**: Use a Personal Access Token instead of password

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (all checkboxes under repo)
4. Generate and save the token
5. Use this token as your password when pushing

### Problem: Permission Denied (SSH)

**Solution**: Set up SSH keys

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub: https://github.com/settings/ssh/new
```

### Problem: "remote origin already exists"

**Solution**: Update the remote URL

```bash
# Remove old remote
git remote remove origin

# Add new remote
git remote add origin https://github.com/YOUR-USERNAME/website-cloner.git
```

### Problem: Push rejected (non-fast-forward)

**Solution**: Pull first, then push

```bash
git pull origin main --rebase
git push origin main
```

### Problem: Large files error

**Solution**: Check what's being committed

```bash
# See file sizes
git ls-files -s | awk '{print $4}' | xargs ls -lh

# If node_modules sneaked in:
git rm -r --cached node_modules
echo "node_modules/" >> .gitignore
git add .gitignore
git commit -m "fix: remove node_modules from git"
git push
```

---

## Next Steps After Pushing

### 1. Create a Development Branch

```bash
git checkout -b develop
git push -u origin develop
```

### 2. Set Branch Protection (Optional)

On GitHub:
1. Go to repository Settings → Branches
2. Add rule for `main` branch
3. Enable: "Require pull request reviews before merging"

### 3. Add Collaborators (if team project)

On GitHub:
1. Settings → Collaborators
2. Add team members by username

### 4. Create First Release (when ready)

```bash
# Tag version 0.1.0
git tag -a v0.1.0 -m "Release v0.1.0 - Phase 2 complete"
git push origin v0.1.0

# On GitHub: Releases → Draft a new release
```

### 5. Add GitHub Actions (CI/CD) - Future

Create `.github/workflows/test.yml` for automated testing

---

## Summary Checklist

- [ ] Created GitHub repository
- [ ] Configured git user name and email
- [ ] Ran `bash init-git.sh` successfully
- [ ] Added remote origin
- [ ] Pushed code to GitHub
- [ ] Verified files appear on GitHub
- [ ] Added repository description and topics
- [ ] Updated README with badges (optional)

---

## Your Repository is Now Live! 🎉

Your repository URL: `https://github.com/YOUR-USERNAME/website-cloner`

Share it with:
- `git clone https://github.com/YOUR-USERNAME/website-cloner.git`

Contributors can now:
```bash
git clone <your-repo-url>
cd website-cloner
bash setup.sh
bash verify.sh
node clone-website.js --config=config.example.json --enumerate
```

---

**Need help?** Check GitHub's official docs: https://docs.github.com/en/get-started
