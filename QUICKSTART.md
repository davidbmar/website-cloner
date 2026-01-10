# Quick Start Guide

## Installation

```bash
cd /home/ubuntu/src/website-cloner
bash setup.sh
```

## Verify Installation

```bash
bash verify.sh
```

## Check Project Status

```bash
bash status.sh
```

## Basic Usage

### 1. Configure Your Target

Edit `my-config.json` (created by setup.sh):

```json
{
  "target": {
    "url": "https://your-target-site.com"
  },
  "crawling": {
    "maxDepth": 3,
    "maxPages": 100
  }
}
```

### 2. Enumerate URLs (Phase 2)

Discover all URLs without downloading:

```bash
node clone-website.js --config=my-config.json --enumerate
```

### 3. Review Manifest

```bash
cat output/manifest.json
```

### 4. Download & Deploy (Phase 3) - Coming Soon

```bash
node clone-website.js --config=my-config.json --download
```

## Helper Scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` | Install dependencies and set up environment |
| `verify.sh` | Verify installation is correct |
| `status.sh` | Show implementation status and next steps |
| `init-git.sh` | Initialize git repository with first commit |

## CLI Commands

```bash
# Show help
node clone-website.js --help

# Enumerate only
node clone-website.js --config=config.json --enumerate

# Download only (Phase 3 - not yet implemented)
node clone-website.js --config=config.json --download

# Full workflow (both phases)
node clone-website.js --config=config.json --full

# Verbose logging
node clone-website.js --config=config.json --enumerate -v

# Skip S3 upload
node clone-website.js --config=config.json --full --skip-s3
```

## Configuration Quick Reference

### Essential Settings

```json
{
  "target": {
    "url": "https://example.com"  // Required: Starting URL
  },
  "crawling": {
    "maxDepth": 3,                // Max BFS depth levels
    "maxPages": 500,              // Max pages to crawl
    "sameDomainOnly": true,       // Stay within domain
    "ignorePatterns": [           // URLs to skip
      "**/logout",
      "**/admin/**"
    ]
  },
  "rateLimit": {
    "enabled": true,
    "requestsPerSecond": 2        // Be respectful!
  }
}
```

## Troubleshooting

### Installation Issues

```bash
# Check Node.js version (need 18+)
node -v

# Reinstall dependencies
rm -rf node_modules
npm install

# Verify again
bash verify.sh
```

### Crawling Issues

```bash
# Use verbose mode to see details
node clone-website.js --config=config.json --enumerate -v

# Check logs
tail -f logs/clone-*.log

# Reduce rate to avoid blocks
# Edit config.json: "requestsPerSecond": 1
```

### Permission Issues

```bash
# Make scripts executable
chmod +x *.sh clone-website.js
```

## File Locations

```
website-cloner/
├── output/manifest.json      # Discovered URLs (Phase 2)
├── output/[domain]/          # Downloaded site (Phase 3)
├── logs/clone-*.log          # Execution logs
└── my-config.json            # Your configuration
```

## Getting Help

1. Read the full README: `README.md`
2. Check implementation status: `bash status.sh`
3. Review detailed plan: `docs/IMPLEMENTATION_PLAN.md`
4. Check changelog: `CHANGELOG.md`

## For Developers

```bash
# Initialize git repository
bash init-git.sh

# Check status
bash status.sh

# Read contributing guide
cat CONTRIBUTING.md
```

## Examples

### Simple Blog Clone

```json
{
  "target": {"url": "https://blog.example.com"},
  "crawling": {
    "maxDepth": 2,
    "maxPages": 50,
    "sameDomainOnly": true
  }
}
```

```bash
node clone-website.js --config=blog-config.json --enumerate
```

### Documentation Site

```json
{
  "target": {"url": "https://docs.example.com"},
  "crawling": {
    "maxDepth": 5,
    "maxPages": 500,
    "allowedPatterns": ["/docs/**"],
    "respectRobotsTxt": true
  }
}
```

```bash
node clone-website.js --config=docs-config.json --enumerate -v
```

## What's Working (v0.1.0)

✅ Phase 2: URL Enumeration
- BFS crawling
- Rate limiting
- Robots.txt support
- Manifest generation

## What's Coming (v0.2.0)

🚧 Phase 3: Asset Extraction
- HTML/CSS/JS/image downloads
- Link rewriting
- Dynamic content detection
- S3 deployment

---

**Need more detail?** See [README.md](README.md) for comprehensive documentation.
