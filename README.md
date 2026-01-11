# Website Cloner

A complete website cloning tool with 6 phases: enumerate URLs, download assets, rewrite links, detect dynamic content, and deploy to S3.

## Features ✅ All Phases Complete

- **Phase 2 (Enumeration)**: Breadth-First Search to discover all URLs without downloading
- **Phase 3 (Asset Extraction)**: Download HTML, CSS, JS, images, fonts from discovered URLs
- **Phase 4 (Link Rewriting)**: Convert absolute URLs to relative paths for static hosting
- **Phase 5 (Dynamic Detection)**: Mark API calls, forms, WebSockets with data attributes for LLM processing
- **Phase 6 (S3 Deployment)**: Upload to S3 with static website hosting configuration
- **Rate Limiting**: Respect target servers with configurable request rates
- **Robots.txt**: Honor robots.txt rules
- **Progress Tracking**: Real-time progress updates during all phases
- **IAM Role Support**: Uses EC2 instance IAM roles for AWS credentials
- **Web UI**: User-friendly browser interface with real-time progress monitoring

## Two Ways to Use

### 🌐 Web UI (Recommended for Beginners)

The easiest way to clone websites with a visual interface:

```bash
npm run ui
# Open http://localhost:3000 in your browser
```

Features:
- Quick start templates (localhost, otter.ai, custom)
- Form-based configuration with sensible defaults
- Real-time progress monitoring
- Interactive results with direct links to deployed sites

See [docs/WEB_UI.md](docs/WEB_UI.md) for complete Web UI documentation.

### 💻 CLI (Command Line Interface)

For automation, scripting, or advanced users:

```bash
node clone-website.js --config=config.json --full
```

See below for full CLI documentation.

## Installation

### Quick Setup (Recommended)

Run the automated setup script:

```bash
cd /home/ubuntu/src/website-cloner
bash setup.sh
```

This will:
- Check Node.js and npm versions
- Install all dependencies
- Create output and logs directories
- Make the CLI executable
- Create a starter configuration file

### Manual Installation

```bash
cd /home/ubuntu/src/website-cloner
npm install
mkdir -p output logs
chmod +x clone-website.js
cp config.example.json my-config.json
```

### Verify Installation

```bash
bash verify.sh
```

This runs automated tests to ensure everything is set up correctly.

## Quick Start (CLI)

**Note**: For the Web UI approach, see [docs/WEB_UI.md](docs/WEB_UI.md) or run `npm run ui`.

### 1. Create Configuration File

```bash
cp config.example.json mysite-config.json
# Edit mysite-config.json with your target URL and settings
```

### 2. Run Enumeration Phase (Phase 2)

Discover all URLs without downloading:

```bash
node clone-website.js --config=mysite-config.json --enumerate
```

This generates `output/manifest.json` with all discovered URLs.

### 3. Review Manifest

```bash
cat output/manifest.json
```

Check the total URLs, max depth, and URL list before proceeding.

### 4. Run Download and Deploy (Phases 3-6)

Download assets, rewrite links, detect dynamic content, and deploy to S3:

```bash
node clone-website.js --config=mysite-config.json --download
```

This will:
- **Phase 3**: Download all HTML pages and assets (CSS, JS, images)
- **Phase 4**: Rewrite all URLs to relative paths for static hosting
- **Phase 5**: Detect and mark dynamic content (API calls, forms, WebSockets)
- **Phase 6**: Upload to S3 with static website hosting configured

### 5. Access Your Deployed Site

After deployment completes, your site will be live at:
```
http://[your-bucket-name].s3-website-[region].amazonaws.com
```

Example: `http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com`

## Configuration

See `config.example.json` for full configuration schema.

### Key Settings

#### Crawling Configuration
- `target.url`: Starting URL to clone
- `crawling.maxDepth`: Maximum BFS depth (levels from seed URL)
- `crawling.maxPages`: Maximum number of pages to crawl
- `crawling.sameDomainOnly`: Restrict to same domain (default: true)
- `crawling.ignorePatterns`: Glob patterns to exclude (e.g., `**/logout`, `**/admin/**`)
- `rateLimit.requestsPerSecond`: Rate limiting to respect target server

#### S3 Deployment Configuration
- `s3.enabled`: Enable/disable S3 upload (default: false)
- `s3.bucket`: S3 bucket name (e.g., "my-landing-page-1768022354")
- `s3.region`: AWS region (e.g., "us-east-1")
- `s3.prefix`: Optional S3 key prefix (folder path)
- `s3.acl`: Access control ("public-read" for public websites)
- `s3.configureWebsiteHosting`: Auto-configure static website hosting (default: true)
- `s3.configureCors`: Configure CORS (optional, requires s3:PutBucketCors permission)
- `s3.indexDocument`: Index document (default: "index.html")
- `s3.errorDocument`: Error document (default: "404.html")

#### Dynamic Content Detection
- `dynamic.detectAPIEndpoints`: Detect fetch/XHR API calls
- `dynamic.detectFormSubmissions`: Detect forms requiring backend
- `dynamic.detectWebSockets`: Detect WebSocket connections
- `dynamic.markerAttribute`: Data attribute for marking (default: "data-marker")
- `dynamic.markerValue`: Marker value (default: "LLM_FIX_REQUIRED")

### AWS IAM Requirements

The tool uses EC2 IAM role credentials. Required S3 permissions:

**Option 1: Specific Bucket (More Secure)**

Replace `my-landing-page-1768022354` with your bucket name:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BucketManagement",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketWebsite",
        "s3:PutBucketWebsite",
        "s3:PutBucketCors",
        "s3:GetBucketCors"
      ],
      "Resource": "arn:aws:s3:::my-landing-page-1768022354"
    },
    {
      "Sid": "S3ObjectManagement",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::my-landing-page-1768022354/*"
    },
    {
      "Sid": "S3PublicAccessManagement",
      "Effect": "Allow",
      "Action": [
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": "arn:aws:s3:::my-landing-page-1768022354"
    },
    {
      "Sid": "S3ListBuckets",
      "Effect": "Allow",
      "Action": "s3:ListAllMyBuckets",
      "Resource": "*"
    }
  ]
}
```

**Option 2: All Buckets (More Flexible)**

Use wildcards to work with any bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BucketManagement",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketWebsite",
        "s3:PutBucketWebsite",
        "s3:PutBucketCors",
        "s3:GetBucketCors",
        "s3:ListAllMyBuckets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3ObjectManagement",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::*/*"
    },
    {
      "Sid": "S3PublicAccessManagement",
      "Effect": "Allow",
      "Action": [
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": "arn:aws:s3:::*"
    }
  ]
}
```

**Note:**
- `s3:PutBucketCors` is optional. If missing, CORS configuration is skipped with a warning.
- Option 1 is more secure but requires updating the policy for each new bucket.
- Option 2 is more flexible for working with multiple buckets.

## CLI Options

```bash
# Enumerate URLs only (Phase 2)
node clone-website.js --config=config.json --enumerate

# Download from existing manifest (Phase 3)
node clone-website.js --config=config.json --download

# Run both phases
node clone-website.js --config=config.json --full

# Skip S3 upload
node clone-website.js --config=config.json --full --skip-s3

# Verbose logging
node clone-website.js --config=config.json --enumerate -v
```

## Two-Phase Approach

### Why Two Phases?

1. **Cost Estimation**: Review scope before downloading
2. **Prevent Waste**: Avoid wasting S3 storage on broken crawls
3. **Scope Verification**: Ensure crawler is capturing the right pages

### Phase 2: Enumeration (Map Stage)

- BFS traversal to discover all URLs
- Generates `manifest.json` with complete URL list
- **STOPS HERE** - allows review before downloading

### Phase 3: Asset Extraction (Clone Stage)

- Reads `manifest.json` from Phase 2
- Downloads all HTML pages with concurrency control
- Extracts and downloads assets: CSS, JS, images (including srcset), fonts
- Handles retries for failed downloads
- Organized directory structure (assets/css, assets/js, assets/images)

### Phase 4: Link Rewriting

- Rewrites all href/src attributes to relative paths
- Rewrites CSS url() references
- Preserves external links (different domains)
- Preserves special protocols (data:, mailto:, tel:)
- Calculates correct relative paths across directory levels

### Phase 5: Dynamic Content Detection

- Analyzes HTML for forms requiring backend (POST, file uploads)
- Detects API calls in JavaScript (fetch, XHR, axios)
- Detects WebSocket connections
- Marks elements with `data-marker="LLM_FIX_REQUIRED"`
- Adds HTML comments explaining what needs fixing
- Generates `dynamic-manifest.json` with recommendations

### Phase 6: S3 Deployment

- Verifies bucket access (uses IAM role credentials)
- Configures static website hosting
- Sets bucket policy for public read access
- Optional CORS configuration
- Uploads all files with correct MIME types
- Sets Cache-Control headers (HTML: no-cache, assets: 1 year)
- Displays website URL after deployment

## Output Files

```
output/
├── manifest.json              # Phase 2: Discovered URLs
├── dynamic-manifest.json      # Phase 3: Dynamic content analysis
├── [domain]/                  # Phase 3: Downloaded site
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── images/
logs/
└── clone-[timestamp].log      # Execution logs
```

## Example

```bash
# Clone example.com
node clone-website.js --config=test-config.json --enumerate

# Output:
# ✓ Enumeration Complete!
# Total URLs discovered: 1
# Max depth reached: 0
# Manifest saved to: output/manifest.json
```

## Implementation Status

### ✅ Completed
- [x] Project setup
- [x] Configuration system
- [x] Logger with colors and file output
- [x] URL utilities (normalization, validation, resolution)
- [x] BFS enumeration (Phase 2)
- [x] Manifest generation
- [x] Rate limiting
- [x] Robots.txt support
- [x] CLI interface

### 🚧 In Progress
- [ ] Asset downloader (Phase 3)
- [ ] Link rewriter
- [ ] Dynamic content detector
- [ ] S3 uploader

### 📋 Planned
- [ ] Full integration testing
- [ ] Documentation improvements
- [ ] Error recovery
- [ ] Resume capability

## Architecture

```
clone-website.js (Main CLI)
├── lib/logger.js (Logging utilities)
├── lib/url-utils.js (URL handling)
├── lib/enumerator.js (Phase 2: BFS crawling)
├── lib/downloader.js (Phase 3: Asset downloads) [TODO]
├── lib/link-rewriter.js (URL rewriting) [TODO]
├── lib/dynamic-detector.js (Dynamic content detection) [TODO]
└── lib/s3-uploader.js (S3 deployment) [TODO]
```

## License

MIT
