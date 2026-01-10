# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Resume capability for interrupted downloads
- Integration tests
- CI/CD pipeline
- Enhanced error recovery
- Multi-site batch processing

## [0.2.0] - 2026-01-10

### Added - All Phases Complete ✅

#### Phase 3: Asset Extraction (Clone Stage)
- **lib/downloader.js** - Complete asset downloading implementation
  - Loads manifest.json from Phase 2 enumeration
  - Downloads HTML pages with concurrency control (p-queue)
  - Extracts assets from HTML: CSS, JS, images, srcset, inline styles
  - Downloads assets with retry logic and file size limits
  - Organized directory structure (assets/css, assets/js, assets/images)
  - Progress tracking and statistics display
  - Returns pages, assets, and assetMapping for next phases

#### Phase 4: Link Rewriting for Static Hosting
- **lib/link-rewriter.js** - URL rewriting engine
  - Rewrites HTML href/src attributes to relative paths
  - Rewrites CSS url() references
  - Handles srcset attributes for responsive images
  - Handles inline styles with background-image
  - Preserves external domain links (keeps them absolute)
  - Preserves special protocols (data:, mailto:, tel:, javascript:)
  - Calculates proper relative paths between files at different depths
  - Updates files in-place on disk

#### Phase 5: Dynamic Content Detection
- **lib/dynamic-detector.js** - Dynamic content analysis
  - Analyzes HTML pages for forms requiring backend processing
  - Detects inline scripts with API calls (fetch, XMLHttpRequest, axios)
  - Detects empty divs that may be populated dynamically
  - Analyzes external JavaScript files for API patterns
  - Detects WebSocket connections
  - Detects dynamic imports
  - Marks dynamic elements with configurable data attributes
  - Adds HTML comments to flag dynamic content for LLM processing
  - Generates dynamic-manifest.json with:
    - Summary statistics
    - List of all detected dynamic elements with context
    - Recommendations for handling dynamic content

#### Phase 6: S3 Deployment
- **lib/s3-uploader.js** - Complete S3 deployment automation
  - Verifies bucket accessibility using IAM role credentials
  - Configures static website hosting (index.html, 404.html)
  - Sets bucket policy for public read access
  - Optional CORS configuration (gracefully handles permission errors)
  - Uploads all files with correct MIME types (using mime-types library)
  - Sets appropriate Cache-Control headers:
    - HTML: no-cache (always fresh)
    - JSON/XML: must-revalidate
    - Assets (CSS/JS/images/fonts): 1 year cache with immutable flag
  - Uses concurrency control (10 parallel uploads)
  - Displays website URL after deployment
  - Comprehensive upload statistics

#### CLI Integration
- Modified **clone-website.js** to orchestrate all 6 phases
  - Phase 2: URL Enumeration (existing)
  - Phase 3: Asset Extraction (new)
  - Phase 4: Link Rewriting (new)
  - Phase 5: Dynamic Content Detection (new)
  - Phase 6: S3 Deployment (new)
  - Proper error handling between phases
  - Clear status messages for each phase
  - Respects --skip-s3 flag
  - Checks config.s3.enabled setting

### Changed
- **test-download-config.json** - Updated with S3 configuration
  - Enabled S3 deployment
  - Bucket: my-landing-page-1768022354
  - Region: us-east-1
  - Public read ACL
  - Static website hosting enabled
  - CORS configuration enabled (optional)

### Tested - End-to-End Validation
- ✅ Complete workflow test with info.cern.ch:
  - Phase 2: 25 URLs enumerated, manifest generated
  - Phase 3: 24 HTML pages downloaded, 0 assets (static HTML site)
  - Phase 4: 48 links rewritten to relative paths, 81 external links preserved
  - Phase 5: 24 pages analyzed, 0 dynamic elements detected (correctly identified as static)
  - Phase 6: 27 files uploaded to S3 (77.1 KB total)
- ✅ Website deployed and accessible at: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com
- ✅ All relative links work correctly across directory levels
- ✅ Static website hosting configured automatically
- ✅ Bucket policy set for public read access
- ✅ Dynamic content manifest generated with recommendations

### Performance
- Complete clone cycle (enumerate → download → rewrite → detect → upload): ~15 seconds
- Parallel asset downloading: 3 concurrent requests
- Parallel S3 uploads: 10 concurrent requests
- Graceful handling of 404 errors during download
- Efficient file I/O with streaming

### Technical Improvements
- Proper separation of concerns across 6 phases
- Each phase can be run independently
- Results passed between phases via return values
- Comprehensive error handling at each phase
- Progress indicators for long-running operations
- Statistics tracking throughout pipeline

## [0.1.1] - 2026-01-10

### Fixed
- **Critical:** Configuration validation bugs causing crashes with minimal configs
  - Added null checks for `config.network.authentication` before accessing `.type`
  - Added null checks for `config.network.cookies` before accessing `.length`
  - Added null checks for `config.crawling.ignorePatterns` and `allowedPatterns`
  - Fixed error: "Cannot read properties of undefined (reading 'type')"
  - Fixed error: "Cannot read properties of undefined (reading 'length')"

### Added
- **TESTING.md** - Comprehensive testing guide with 8 test scenarios
- **TEST_REPORT.md** - Detailed test report documenting Phase 2 validation
- **run-tests.sh** - Automated test suite with 3 test cases
- **complex-test-config.json** - Configuration for testing with real documentation sites
- **push-update.sh** - Helper script for quick git pushes with token
- **MANUAL_PUSH.md** - Manual GitHub push instructions
- **QUICK_PUSH_GUIDE.txt** - Quick reference for pushing to GitHub
- Test configuration directory: `test-configs/`

### Changed
- **config.example.json** - Updated to use otter.ai as example with depth 5
- Improved error handling in enumerator.js for missing configuration properties
- Made authentication, cookies, and pattern arrays optional in configurations

### Tested
- ✅ Automated test suite: 3/3 tests passed
- ✅ Simple static site (example.com): Working
- ✅ Multi-page site with depth control (info.cern.ch): Working
- ✅ Rate limiting: Validated at 2 requests/second
- ✅ Complex real-world site (golang.org/doc/): 724 URLs discovered
- ✅ 404 error handling: Graceful recovery
- ✅ Robots.txt: Loading and respecting rules
- ✅ Pattern matching: Ignore patterns working correctly

### Performance
- Successfully crawled 724 URLs from golang.org/doc/
- Processed 47 pages in ~25 seconds
- Rate limiting working correctly at 2 req/sec
- Memory usage: Reasonable for 700+ URLs

### Documentation
- Added comprehensive test report with metrics
- Updated testing documentation
- Added multiple GitHub push helper scripts

## [0.1.0] - 2026-01-10

### Added - Phase 2 Complete ✅

#### Project Setup
- Initial project structure with organized directories
- `package.json` with ES modules support
- Dependencies: axios, cheerio, commander, chalk, ora, p-queue, robots-parser, mime-types, AWS SDK S3
- `.gitignore` for node_modules, output, logs, credentials
- `setup.sh` - Automated installation script
- `verify.sh` - Installation verification script
- `README.md` - Comprehensive usage documentation
- `docs/IMPLEMENTATION_PLAN.md` - Detailed technical plan

#### Core Infrastructure (lib/)
- **lib/logger.js** - Color-coded logging system
  - Console output with timestamps
  - File logging with rotation
  - Log levels: error, warn, info, debug, success
  - Progress updates with clearable output
  - Section headers for phase separation

- **lib/url-utils.js** - URL manipulation utilities
  - `normalizeUrl()` - Deduplication-safe normalization
  - `isSameDomain()` - Domain comparison with subdomain support
  - `matchesPattern()` - Glob pattern matching for ignore/allow lists
  - `resolveUrl()` - Relative to absolute URL resolution
  - `urlToFilePath()` - URL to filesystem path conversion
  - `calculateRelativePath()` - Relative path calculation for link rewriting
  - `getAssetType()` - Asset type detection from extension
  - Protocol-relative URL handling (// → https://)
  - Special protocol detection (data:, mailto:, tel:)

- **lib/enumerator.js** - BFS crawling engine (Phase 2)
  - Breadth-First Search algorithm implementation
  - Queue-based traversal with depth tracking
  - Visited set for deduplication
  - Discovered set for all found URLs
  - Parent-child URL relationship tracking
  - robots.txt parsing and respect
  - Rate limiting with token bucket algorithm
  - Retry logic with exponential backoff
  - Pattern matching for ignore/allow lists
  - Same-domain restriction with subdomain support
  - Link extraction from multiple HTML elements:
    - `<a href>` tags
    - `<link href>` tags (alternate, canonical)
    - `<iframe src>` tags
  - HTML-only filtering (skips non-HTML content types)
  - Real-time progress reporting
  - Manifest generation organized by depth

#### CLI Interface (clone-website.js)
- Commander.js-based CLI
- Options:
  - `--config` - Required configuration file path
  - `--enumerate` - Phase 2 only (URL discovery)
  - `--download` - Phase 3 only (asset download) [placeholder]
  - `--full` - Both phases
  - `--skip-s3` - Skip S3 upload
  - `--dry-run` - Simulation mode
  - `-v, --verbose` - Debug logging
- Color-coded output with ASCII art header
- Phase separation with clear section headers
- Summary statistics display
- Next steps guidance

#### Configuration System
- **config.example.json** - Comprehensive configuration template
- Configuration sections:
  - `target` - Starting URL and description
  - `crawling` - BFS parameters (depth, pages, domain, robots.txt, patterns)
  - `assets` - Asset types and size limits
  - `dynamic` - Dynamic content detection settings
  - `network` - HTTP client configuration (timeout, retries, auth, headers)
  - `rateLimit` - Rate limiting parameters
  - `output` - Local storage settings
  - `s3` - S3 deployment configuration
  - `logging` - Log levels and file output

#### Output Files
- **output/manifest.json** - Generated URL manifest
  - Metadata: timestamp, start URL, totals, max depth
  - URLs organized by depth level
  - URL details: url, normalized URL, depth, parent
  - Configuration snapshot

### Testing
- Successfully tested Phase 2 enumeration with example.com
- Verified manifest.json generation
- Confirmed rate limiting functionality
- Validated robots.txt handling

### Documentation
- README.md with quick start guide
- Implementation plan with technical details
- Inline code documentation
- CLI help text
- Example configurations

### Development Setup
- ES modules (type: "module" in package.json)
- Executable CLI with shebang
- Organized lib/ directory structure
- Separation of concerns (logger, utils, crawler, etc.)

---

## Implementation Notes

### Architecture Decisions

1. **Two-Phase Approach**
   - Separate enumeration from downloading
   - Allows cost/scope review before asset download
   - Prevents wasted S3 storage on broken crawls

2. **BFS Over DFS**
   - Breadth-first ensures maximum coverage at each depth
   - Better for wide sites with deep hierarchies
   - Respects maxDepth configuration more intuitively

3. **URL Normalization**
   - Critical for preventing duplicate crawls
   - Handles edge cases: trailing slashes, query params, fragments
   - Protocol-relative URL standardization

4. **Rate Limiting**
   - Token bucket algorithm for burst handling
   - Configurable requests per second
   - Respects target server resources

5. **ES Modules**
   - Modern import/export syntax
   - Better for future maintainability
   - Required for latest versions of dependencies

### Known Limitations (v0.1.0)

- Phase 3 (download) not yet implemented
- No asset downloading or storage
- No link rewriting
- No dynamic content detection
- No S3 upload functionality
- Limited error recovery (no resume capability)
- No progress bars (using simple text output)

### Next Development Phase

Priority tasks for v0.2.0:
1. Implement lib/downloader.js - Asset downloading from manifest
2. Implement lib/link-rewriter.js - URL rewriting for static hosting
3. Implement lib/dynamic-detector.js - Dynamic content marking
4. Integrate Phase 3 into CLI
5. Test with multi-page websites

---

## Git Repository Setup

### Initial Commit Structure
```
/home/ubuntu/src/website-cloner/
├── .gitignore
├── CHANGELOG.md (this file)
├── README.md
├── package.json
├── config.example.json
├── setup.sh
├── verify.sh
├── clone-website.js
├── docs/
│   └── IMPLEMENTATION_PLAN.md
└── lib/
    ├── logger.js
    ├── url-utils.js
    └── enumerator.js
```

### Not Committed (per .gitignore)
- node_modules/
- output/
- logs/
- test-config.json
- .env files
- AWS credentials

---

## Version History

- **v0.1.0** (2026-01-10) - Phase 2 complete: URL enumeration with BFS, manifest generation
- **v0.2.0** (Planned) - Phase 3: Asset downloading, link rewriting, dynamic detection
- **v0.3.0** (Planned) - S3 deployment with website hosting
- **v1.0.0** (Planned) - Full feature set with testing and documentation

---

## Contributors

Built with Claude Code (Sonnet 4.5) on 2026-01-10
