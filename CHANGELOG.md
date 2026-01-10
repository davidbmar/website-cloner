# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Phase 3: Asset downloader implementation
- Link rewriting for static hosting
- Dynamic content detection with data-marker attributes
- S3 upload with website hosting configuration
- Progress bars with ora spinner
- Resume capability for interrupted downloads
- Integration tests
- CI/CD pipeline

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
