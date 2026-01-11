# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js CLI tool for cloning websites using a multi-phase approach: enumerate URLs, download assets, rewrite links for static hosting, detect dynamic content, and deploy to S3 with static website hosting configuration.

## Core Commands

### Development
```bash
# Run enumeration phase only (discover URLs without downloading)
node clone-website.js --config=config.json --enumerate

# Run download phase (from existing manifest.json)
node clone-website.js --config=config.json --download

# Run both phases together
node clone-website.js --config=config.json --full

# Skip S3 upload
node clone-website.js --config=config.json --download --skip-s3

# Enable verbose logging
node clone-website.js --config=config.json --enumerate -v
```

### Setup and Testing
```bash
# Automated setup (install dependencies, create directories)
bash setup.sh

# Run verification tests
bash verify.sh

# Install dependencies manually
npm install
```

### NPM Scripts
```bash
npm start              # Alias for node clone-website.js
npm run enumerate      # Enumeration only
npm run download       # Download only
npm run full           # Both phases
```

## Architecture

### Six-Phase Pipeline

The tool processes websites through six distinct phases:

1. **Phase 2 - Enumeration (Map Stage)**: BFS traversal to discover all URLs, respects robots.txt, generates `manifest.json`
2. **Phase 3 - Asset Extraction (Clone Stage)**: Downloads HTML pages and assets (CSS, JS, images, fonts) with concurrency control
3. **Phase 4 - Link Rewriting**: Converts absolute URLs to relative paths for static hosting
4. **Phase 5 - Dynamic Detection**: Marks forms, API calls, WebSockets with data attributes for LLM processing
5. **Phase 6 - S3 Deployment**: Uploads to S3, configures static website hosting, sets bucket policies

**Critical Design Pattern**: Phases 2 and 3 are separated to allow reviewing scope and cost before downloading. This prevents wasting S3 storage on broken crawls.

### Core Modules

**clone-website.js**: Main CLI entry point, orchestrates all phases, handles command-line arguments via commander.js

**lib/enumerator.js**: BFS URL discovery with:
- Rate limiting (token bucket algorithm)
- Robots.txt parsing and respect
- Pattern matching (ignore/allow patterns)
- Depth tracking
- Deduplication using normalized URLs

**lib/downloader.js**: Asset downloading with:
- Concurrent downloads (p-queue)
- Retry logic with exponential backoff
- Asset type detection (CSS, JS, images, fonts)
- srcset parsing for responsive images
- CSS @import and url() extraction
- Asset mapping for link rewriting

**lib/link-rewriter.js**: URL transformation with:
- Relative path calculation across directory levels
- Preservation of external links (different domains)
- Preservation of special protocols (data:, mailto:, tel:, javascript:)
- CSS url() rewriting
- srcset attribute rewriting
- Inline style rewriting

**lib/dynamic-detector.js**: Dynamic content analysis:
- Form detection (POST methods, file uploads, action URLs containing /api/)
- API call detection in JavaScript (fetch, XMLHttpRequest, axios patterns)
- WebSocket detection (ws://, wss:// protocols, new WebSocket)
- SPA mount point detection (empty divs with id="app", "root", etc.)
- Marks elements with `data-marker="LLM_FIX_REQUIRED"`
- Generates `dynamic-manifest.json` with recommendations

**lib/s3-uploader.js**: S3 deployment with:
- IAM role credential support (no hardcoded keys)
- Bucket website hosting configuration
- Public read bucket policy setup
- Public access block configuration
- Optional CORS configuration
- Content-Type detection via mime-types
- Cache-Control headers (HTML: no-cache, assets: 1 year)
- Concurrent uploads

**lib/url-utils.js**: URL handling utilities:
- Normalization (strip fragments, sort query params, lowercase protocol/domain)
- Validation (protocol checks, malformed URL detection)
- Same-domain checking with subdomain support
- Pattern matching (glob-style with ** and * support)
- File path generation (URL to local file path conversion)
- Asset type detection from extensions
- Special protocol detection (data:, mailto:, tel:, javascript:, blob:)

**lib/logger.js**: Colored console output with chalk, file logging, progress indicators, section separators

### Data Flow

```
Config File → Enumerator → manifest.json
                              ↓
manifest.json → Downloader → Downloaded HTML/Assets + Asset Mapping
                              ↓
Asset Mapping → LinkRewriter → Rewritten HTML/CSS (relative paths)
                              ↓
Rewritten Files → DynamicDetector → Marked HTML + dynamic-manifest.json
                              ↓
Local Files → S3Uploader → S3 Bucket (static website hosting)
```

### Key Data Structures

**Manifest (output/manifest.json)**:
```javascript
{
  totalUrls: number,
  actualMaxDepth: number,
  startUrl: string,
  generatedAt: ISO timestamp,
  byDepth: { [depth: number]: string[] },  // URLs organized by BFS depth
  urlDetails: Array<{ url, depth, parent }>
}
```

**Asset Mapping (in-memory during processing)**:
```javascript
Map<originalUrl, localPath>
// Example: 'https://site.com/css/app.css' → './output/site.com/css/app.css'
```

**Dynamic Manifest (output/dynamic-manifest.json)**:
```javascript
{
  totalPages: number,
  pagesWithDynamic: number,
  dynamicElements: Array<{
    type: 'form' | 'api_call' | 'websocket' | 'spa_mount',
    details: object,
    foundIn: string[]  // URLs where element was found
  }>,
  recommendations: string[]
}
```

## Configuration

Configuration files use JSON format. See `config.example.json` for full schema.

### Critical Settings

**crawling.maxDepth**: BFS depth limit (0 = seed URL only, 1 = seed + direct links, etc.)

**crawling.maxPages**: Maximum URLs to enumerate (safety limit)

**crawling.sameDomainOnly**: Whether to stay on same domain (usually true for cloning)

**crawling.ignorePatterns**: Glob patterns to skip (e.g., `**/logout`, `**/admin/**`)

**network.concurrency**: Number of parallel downloads (balance between speed and server load)

**rateLimit.requestsPerSecond**: Token bucket rate limiting to respect target servers

**s3.enabled**: Toggle S3 upload phase

**s3.configureWebsiteHosting**: Auto-configure bucket for static hosting (sets index/error documents)

**s3.prefix**: S3 key prefix (subdirectory) for hosting multiple sites in one bucket

## AWS IAM Requirements

The tool uses EC2 IAM role credentials (no hardcoded keys). Required S3 permissions:

**Bucket-level**:
- s3:CreateBucket (if bucket doesn't exist)
- s3:ListBucket
- s3:GetBucketLocation
- s3:GetBucketWebsite, s3:PutBucketWebsite
- s3:PutBucketPolicy, s3:GetBucketPolicy
- s3:PutBucketPublicAccessBlock
- s3:PutBucketCors, s3:GetBucketCors (optional, will skip with warning if missing)
- s3:ListAllMyBuckets

**Object-level**:
- s3:PutObject, s3:GetObject, s3:DeleteObject
- s3:PutObjectAcl

See README.md for example IAM policy JSON.

## Development Notes

### URL Normalization Strategy

All URLs are normalized before storage/comparison to prevent duplicates:
1. Parse with URL constructor
2. Lowercase protocol and domain
3. Strip fragment identifiers (#section)
4. Sort query parameters alphabetically
5. Remove trailing slashes (except for root paths)

This ensures `https://Site.com/page?b=2&a=1` equals `https://site.com/page?a=1&b=2`

### Link Rewriting Algorithm

Calculate relative paths between source and target files:
1. Convert both URLs to local file paths
2. Calculate relative path from source directory to target file
3. Preserve external links (different domain)
4. Preserve special protocols (data:, mailto:, tel:, javascript:)
5. Handle directory index files (page/ → page/index.html)

Example: `/blog/post.html` linking to `/css/style.css` becomes `../css/style.css`

### Asset Extraction Recursion

- HTML pages extract assets from `<link>`, `<script>`, `<img>`, `<source>`, `srcset` attributes, inline styles
- CSS files extract assets from `url()` functions and `@import` statements
- Asset downloads are tracked to prevent duplicates
- Failed downloads are logged but don't fail the entire process

### Dynamic Content Detection

Detects patterns that require backend/API support:

**Forms**: POST methods, file input types, action URLs containing `/api/`

**API Calls**: JavaScript patterns like `fetch(`, `axios.`, `XMLHttpRequest`, `$.ajax`

**WebSockets**: `new WebSocket`, `ws://`, `wss://` protocols

**SPA Mounts**: Empty divs with specific IDs (app, root, main, content)

Marks elements with `data-marker="LLM_FIX_REQUIRED"` and `data-reason="..."` for post-processing.

### S3 Upload Strategy

- HTML files: `Cache-Control: no-cache, no-store, must-revalidate` (always fresh)
- Assets (CSS/JS/images/fonts): `Cache-Control: public, max-age=31536000` (1 year)
- All files: Correct Content-Type via mime-types library
- Concurrent uploads via p-queue
- Static website hosting: index.html for directory requests, 404.html for errors

### Error Handling Patterns

- Enumerator: Skip URLs that fail to fetch, log warning, continue enumeration
- Downloader: Retry failed downloads up to `network.retryAttempts` times with exponential backoff
- Link Rewriter: Preserve original URL if rewriting fails
- S3 Uploader: Log upload failures but continue with remaining files

## Common Tasks

### Adding Support for New Asset Types

1. Update `config.assets` schema with new format list
2. Add extension to `url-utils.js:getAssetType()`
3. Update `downloader.js:extractAssets()` to detect the asset type
4. Add Content-Type mapping in `s3-uploader.js` if needed

### Modifying BFS Behavior

Edit `lib/enumerator.js:enumerate()` method. Key variables:
- `queue`: BFS queue (push to end, shift from start)
- `visited`: Set of normalized URLs already processed
- `discovered`: Map of all found URLs with metadata

### Adjusting Link Rewriting Logic

Edit `lib/link-rewriter.js:rewriteAll()` method. Handles:
- HTML attributes (href, src, srcset)
- CSS url() functions
- Inline styles
- Uses `calculateRelativePath()` for path computation

### Adding Dynamic Detection Rules

Edit `lib/dynamic-detector.js:detectInPage()` method. Pattern:
1. Use cheerio selectors to find elements
2. Check conditions for dynamic behavior
3. Add data attributes: `$(el).attr('data-marker', config.dynamic.markerValue)`
4. Track in dynamicElements array for manifest

## File Organization

```
output/
├── manifest.json              # Phase 2 output
├── dynamic-manifest.json      # Phase 5 output
└── [domain]/                  # Phase 3 output (downloaded files)
    ├── index.html
    ├── about/index.html
    ├── css/
    ├── js/
    ├── images/
    └── fonts/

logs/
└── clone-[timestamp].log      # Execution logs with colors
```

Local file paths preserve URL structure: `https://site.com/blog/post.html` → `output/site.com/blog/post.html`

## Known Limitations

- No JavaScript execution (cannot clone SPAs that render content client-side)
- No authentication beyond basic/bearer tokens in config
- No handling of infinite scroll or pagination via JavaScript
- Robots.txt respected but not enforced for asset downloads
- CORS issues during download don't affect final S3 deployment (assets are re-hosted)
