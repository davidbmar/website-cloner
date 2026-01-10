# Website Cloning Tool - Implementation Plan

## Overview

Create a standalone Node.js tool that clones websites using a **TWO-PHASE** approach: first enumerate URLs (map the territory), then download assets. This allows reviewing scope and estimated cost before downloading. The tool detects dynamic content, rewrites links for static hosting, and deploys to S3.

## Critical Design Decision: Two-Phase Approach

**Phase 2 (Enumeration - "Map Stage"):**
- BFS traversal to discover ALL URLs
- Generate `manifest.json` with complete URL list
- **STOP HERE** - allow review of scope/cost before downloading

**Phase 3 (Asset Extraction - "Clone Stage"):**
- Read `manifest.json`
- Download HTML, CSS, JS, images, fonts for each URL
- Rewrite links for static hosting
- Mark dynamic content with `data-marker="LLM_FIX_REQUIRED"`

This separation prevents wasting S3 storage on broken crawls and allows cost estimation.

## Project Structure

```
/home/ubuntu/src/website-cloner/
├── clone-website.js          # Main entry point and CLI handler
├── package.json              # Dependencies and scripts
├── README.md                 # Documentation
├── config.example.json       # Example configuration file
├── docs/
│   └── IMPLEMENTATION_PLAN.md # This file
├── lib/
│   ├── enumerator.js         # Phase 2: BFS URL enumeration (map stage)
│   ├── downloader.js         # Phase 3: Asset downloading (clone stage)
│   ├── link-rewriter.js      # URL rewriting for static hosting
│   ├── dynamic-detector.js   # Dynamic content detection
│   ├── s3-uploader.js        # S3 upload and configuration
│   ├── logger.js             # Logging utilities
│   ├── url-utils.js          # URL normalization and validation
│   └── manifest-generator.js # URL manifest creation
├── output/                   # Local output directory (gitignored)
│   ├── manifest.json         # Generated URL list from Phase 2
│   ├── [domain]/             # Downloaded site files from Phase 3
│   └── dynamic-manifest.json # Dynamic content analysis
└── logs/                     # Execution logs (gitignored)
```

## Configuration File Schema

```json
{
  "target": {
    "url": "https://example.com",
    "description": "Optional description"
  },

  "crawling": {
    "maxDepth": 3,
    "maxPages": 500,
    "sameDomainOnly": true,
    "includeSubdomains": true,
    "respectRobotsTxt": true,
    "ignorePatterns": [
      "**/logout",
      "**/admin/**",
      "**/login"
    ],
    "allowedPatterns": [
      "/docs/**",
      "/blog/**"
    ]
  },

  "assets": {
    "downloadImages": true,
    "downloadCSS": true,
    "downloadJS": true,
    "downloadFonts": true,
    "downloadVideos": false,
    "maxFileSize": 10485760
  },

  "dynamic": {
    "detectAPIEndpoints": true,
    "detectFormSubmissions": true,
    "detectWebSockets": true,
    "detectEmptyDivs": true,
    "markerAttribute": "data-marker",
    "markerValue": "LLM_FIX_REQUIRED",
    "generateManifest": true
  },

  "network": {
    "concurrency": 5,
    "retryAttempts": 3,
    "retryDelay": 1000,
    "timeout": 30000,
    "userAgent": "Mozilla/5.0 (Website Cloner Bot)",
    "headers": {},
    "cookies": []
  },

  "rateLimit": {
    "enabled": true,
    "requestsPerSecond": 2,
    "burstSize": 10
  },

  "output": {
    "localDirectory": "./output",
    "preserveDirectoryStructure": true
  },

  "s3": {
    "enabled": true,
    "bucket": "my-cloned-websites",
    "region": "us-west-2",
    "prefix": "example-com-clone",
    "acl": "public-read",
    "configureWebsiteHosting": true,
    "indexDocument": "index.html",
    "errorDocument": "404.html"
  }
}
```

## Phase 2: URL Enumeration (Map Stage)

### Purpose
Discover all URLs without downloading assets. This creates a complete map of the website structure and allows reviewing scope before downloading.

### Data Structures
```javascript
{
  visited_urls: Set<normalizedUrl>,        // Prevent infinite loops
  crawl_queue: [{url, depth, parent}],     // BFS queue
  discovered: Map<url, {depth, parent}>,   // All found URLs with metadata
}
```

### BFS Algorithm
```javascript
async function enumerateUrls(startUrl, config) {
  const visited = new Set();
  const queue = [{url: startUrl, depth: 0, parent: null}];
  const discovered = new Map();

  while (queue.length > 0 && visited.size < config.crawling.maxPages) {
    const {url, depth, parent} = queue.shift();

    // Skip if already visited or depth exceeded
    if (visited.has(url) || depth > config.crawling.maxDepth) continue;

    // Check ignore patterns
    if (matchesIgnorePattern(url, config.crawling.ignorePatterns)) continue;

    // Check robots.txt
    if (config.crawling.respectRobotsTxt && !canCrawl(url)) continue;

    visited.add(url);
    discovered.set(url, {depth, parent, timestamp: Date.now()});

    // Fetch ONLY the HTML (lightweight request)
    const html = await fetchHtml(url);

    // Extract all links using cheerio
    const links = extractLinks(html, url);

    // Enqueue new URLs
    for (const link of links) {
      const normalized = normalizeUrl(link);
      if (!visited.has(normalized) && !discovered.has(normalized)) {
        if (config.crawling.sameDomainOnly && !isSameDomain(normalized, startUrl)) {
          continue;
        }
        queue.push({url: normalized, depth: depth + 1, parent: url});
        discovered.set(normalized, {depth: depth + 1, parent: url, queued: true});
      }
    }
  }

  return discovered;
}
```

### Manifest Generation
After enumeration completes, generate `manifest.json`:

```json
{
  "generatedAt": "2026-01-10T12:00:00Z",
  "startUrl": "https://example.com",
  "totalUrls": 150,
  "maxDepth": 3,
  "byDepth": {
    "0": ["https://example.com"],
    "1": ["https://example.com/about", "https://example.com/blog"],
    "2": ["https://example.com/blog/post-1", "https://example.com/blog/post-2"],
    "3": ["https://example.com/blog/post-1/comments"]
  },
  "urlDetails": [
    {
      "url": "https://example.com",
      "depth": 0,
      "parent": null
    },
    {
      "url": "https://example.com/about",
      "depth": 1,
      "parent": "https://example.com"
    }
  ],
  "estimatedSize": "~50MB",
  "estimatedFiles": 150
}
```

### CLI for Phase 2
```bash
# Only enumerate URLs (Phase 2)
node clone-website.js --config=config.json --enumerate-only

# Output: manifest.json created
# Review manifest.json before proceeding
```

## Phase 3: Asset Extraction (Clone Stage)

### Purpose
Read `manifest.json` and download all assets for each URL. Rewrite links, detect dynamic content, and prepare for S3 upload.

### Process
```javascript
async function cloneWebsite(manifestPath, config) {
  // 1. Load manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath));

  // 2. For each URL in manifest
  for (const urlDetail of manifest.urlDetails) {
    // 2a. Download HTML
    const html = await fetchHtml(urlDetail.url);

    // 2b. Parse and extract asset URLs
    const assets = extractAssets(html, config);  // CSS, JS, images, fonts

    // 2c. Download assets (with concurrency control)
    await downloadAssets(assets, config);

    // 2d. Store HTML for later rewriting
    storeHtml(urlDetail.url, html);
  }

  // 3. Rewrite all links to relative paths
  await rewriteLinks(config);

  // 4. Detect and mark dynamic content
  await detectDynamicContent(config);

  // 5. Generate dynamic-manifest.json
  await generateDynamicManifest(config);
}
```

### Asset Downloading
```javascript
async function downloadAssets(assets, config) {
  const queue = new PQueue({concurrency: config.network.concurrency});
  const assetMap = new Map();  // URL -> local path

  for (const asset of assets) {
    queue.add(async () => {
      const content = await fetchAsset(asset.url);
      const localPath = generateLocalPath(asset.url, asset.type);
      fs.writeFileSync(localPath, content);
      assetMap.set(asset.url, localPath);
    });
  }

  await queue.onIdle();
  return assetMap;
}
```

## Link Rewriting (Path Localization)

### Transformation
```javascript
// Original (absolute):
<link href="https://site.com/css/app.css" rel="stylesheet">
<script src="https://site.com/js/app.js"></script>
<img src="https://site.com/images/logo.png">

// Rewritten (relative):
<link href="./css/app.css" rel="stylesheet">
<script src="./js/app.js"></script>
<img src="./images/logo.png">
```

### Implementation
```javascript
function rewriteLinks(html, currentUrl, assetMap) {
  const $ = cheerio.load(html);

  // Rewrite <a> tags
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    $(el).attr('href', rewriteUrl(href, currentUrl, assetMap));
  });

  // Rewrite <link> tags (CSS)
  $('link[href]').each((i, el) => {
    const href = $(el).attr('href');
    $(el).attr('href', rewriteUrl(href, currentUrl, assetMap));
  });

  // Rewrite <script> tags
  $('script[src]').each((i, el) => {
    const src = $(el).attr('src');
    $(el).attr('src', rewriteUrl(src, currentUrl, assetMap));
  });

  // Rewrite <img> tags
  $('img[src]').each((i, el) => {
    const src = $(el).attr('src');
    $(el).attr('src', rewriteUrl(src, currentUrl, assetMap));
  });

  // Rewrite srcset attributes
  $('[srcset]').each((i, el) => {
    const srcset = $(el).attr('srcset');
    $(el).attr('srcset', rewriteSrcset(srcset, currentUrl, assetMap));
  });

  // Rewrite inline styles with url()
  $('[style]').each((i, el) => {
    const style = $(el).attr('style');
    $(el).attr('style', rewriteInlineStyle(style, currentUrl, assetMap));
  });

  return $.html();
}
```

## Dynamic Content Detection & Marking

### Detection Targets
1. **API Endpoints**: `fetch()`, `XMLHttpRequest`, `axios`
2. **Form Submissions**: `<form method="POST">`, action URLs with `/api/`
3. **WebSockets**: `new WebSocket()`
4. **Empty Divs**: Common JS entry points like `<div id="app"></div>`, `<div id="root"></div>`

### Marking Strategy
Use data attributes instead of HTML comments:

```javascript
// Original:
<div id="app"></div>

// Marked:
<div id="app" data-marker="LLM_FIX_REQUIRED" data-reason="JS mount point - likely dynamic SPA content"></div>

// Original:
<form action="/api/submit" method="POST">

// Marked:
<form action="/api/submit" method="POST" data-marker="LLM_FIX_REQUIRED" data-reason="POST form to /api/submit">
```

### Implementation
```javascript
function detectAndMarkDynamic(html, config) {
  const $ = cheerio.load(html);
  const dynamicElements = [];

  // 1. Detect empty divs (SPA mount points)
  if (config.dynamic.detectEmptyDivs) {
    $('div[id]').each((i, el) => {
      if ($(el).children().length === 0 || $(el).text().trim() === '') {
        const id = $(el).attr('id');
        if (['app', 'root', 'main', 'content'].includes(id)) {
          $(el).attr(config.dynamic.markerAttribute, config.dynamic.markerValue);
          $(el).attr('data-reason', `JS mount point - likely dynamic SPA content`);
          dynamicElements.push({type: 'spa_mount', id});
        }
      }
    });
  }

  // 2. Detect POST forms
  if (config.dynamic.detectFormSubmissions) {
    $('form[method="POST"], form[action*="/api/"]').each((i, el) => {
      const action = $(el).attr('action');
      $(el).attr(config.dynamic.markerAttribute, config.dynamic.markerValue);
      $(el).attr('data-reason', `POST form to ${action}`);
      dynamicElements.push({type: 'form', action});
    });
  }

  // 3. Detect API calls in JavaScript
  if (config.dynamic.detectAPIEndpoints) {
    $('script').each((i, el) => {
      const script = $(el).html();
      if (script) {
        const fetchMatches = script.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g);
        if (fetchMatches) {
          // Add comment before script tag
          $(el).before(`<!-- ${config.dynamic.markerValue}: API calls detected in script -->`);
          fetchMatches.forEach(match => {
            dynamicElements.push({type: 'api_call', context: match});
          });
        }
      }
    });
  }

  return {html: $.html(), dynamicElements};
}
```

### Dynamic Manifest
```json
{
  "generatedAt": "2026-01-10T14:00:00Z",
  "totalPages": 150,
  "pagesWithDynamic": 23,
  "dynamicElements": [
    {
      "type": "spa_mount",
      "id": "app",
      "foundIn": ["https://example.com/dashboard"]
    },
    {
      "type": "form",
      "action": "/api/contact",
      "foundIn": ["https://example.com/contact"]
    },
    {
      "type": "api_call",
      "context": "fetch('/api/users')",
      "foundIn": ["https://example.com/dashboard"]
    }
  ],
  "recommendations": [
    "SPA mount points need hydration with mock data",
    "Forms require serverless functions or API Gateway",
    "API calls should be replaced with static JSON or mocked"
  ]
}
```

## S3 Deployment

### Directory Structure
Organize locally before upload:
```
output/
├── index.html
├── about/
│   └── index.html
├── blog/
│   ├── index.html
│   └── post-1/
│       └── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── images/
    └── logo.png
```

### S3 Upload Process
```javascript
async function uploadToS3(localDir, config) {
  const s3Client = new S3Client({region: config.s3.region});

  // 1. Configure bucket for static website hosting
  await s3Client.send(new PutBucketWebsiteCommand({
    Bucket: config.s3.bucket,
    WebsiteConfiguration: {
      IndexDocument: {Suffix: config.s3.indexDocument},
      ErrorDocument: {Key: config.s3.errorDocument}
    }
  }));

  // 2. Set bucket policy for public read
  await s3Client.send(new PutBucketPolicyCommand({
    Bucket: config.s3.bucket,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${config.s3.bucket}/*`
      }]
    })
  }));

  // 3. Upload all files with correct Content-Type
  const files = getAllFiles(localDir);
  for (const file of files) {
    const key = path.relative(localDir, file);
    const contentType = mime.lookup(file) || 'application/octet-stream';

    await s3Client.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: path.join(config.s3.prefix, key).replace(/\\/g, '/'),
      Body: fs.readFileSync(file),
      ContentType: contentType,
      ACL: config.s3.acl
    }));
  }

  const websiteUrl = `http://${config.s3.bucket}.s3-website-${config.s3.region}.amazonaws.com`;
  return websiteUrl;
}
```

### Critical: Content-Type Mapping
```javascript
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};
```

## CLI Commands

### Two-Phase Workflow
```bash
# Phase 1: Enumerate URLs only
node clone-website.js --config=config.json --enumerate

# Review manifest.json
cat output/manifest.json

# Phase 2: Download and deploy
node clone-website.js --config=config.json --download

# Or run both phases together
node clone-website.js --config=config.json --full
```

### Optional Flags
```bash
--enumerate-only   # Phase 2 only: enumerate URLs
--download-only    # Phase 3 only: download from manifest
--full             # Run both phases
--skip-s3          # Skip S3 upload
--dry-run          # Simulate without writing
-v, --verbose      # Verbose logging
```

## Implementation Order

### Phase 1: Project Setup
- [x] Create directory structure
- [ ] Initialize package.json
- [ ] Create config.example.json
- [ ] Create README.md

### Phase 2: Core Infrastructure
- [ ] lib/logger.js
- [ ] lib/url-utils.js
- [ ] clone-website.js (CLI skeleton)

### Phase 3: URL Enumeration
- [ ] lib/enumerator.js (BFS enumeration)
- [ ] lib/manifest-generator.js

### Phase 4: Asset Extraction
- [ ] lib/downloader.js
- [ ] lib/link-rewriter.js

### Phase 5: Dynamic Detection
- [ ] lib/dynamic-detector.js

### Phase 6: S3 Deployment
- [ ] lib/s3-uploader.js

### Phase 7: Testing
- [ ] Test with simple static site
- [ ] Test with site containing dynamic content
- [ ] Verify S3 deployment

## Success Criteria

1. ✅ **Enumeration works**: Generates complete URL manifest without downloading
2. ✅ **Manifest review**: User can review scope/cost before proceeding
3. ✅ **Download works**: Downloads all assets from manifest
4. ✅ **Links rewritten**: All URLs converted to relative paths
5. ✅ **Dynamic marked**: Dynamic content marked with data attributes
6. ✅ **S3 deploys**: Files upload with correct Content-Type
7. ✅ **Site loads**: Static site accessible via S3 URL

## NPM Dependencies

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0-rc.12",
    "p-queue": "^8.0.0",
    "robots-parser": "^3.0.0",
    "mime-types": "^2.1.35",
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0",
    "dotenv": "^16.3.0"
  }
}
```
