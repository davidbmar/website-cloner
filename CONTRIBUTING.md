# Contributing to Website Cloner

Thank you for your interest in contributing! This document provides guidelines and procedures for development.

## Development Setup

### Initial Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd website-cloner
```

2. Run the setup script:
```bash
bash setup.sh
```

3. Verify installation:
```bash
bash verify.sh
```

### Development Environment

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **OS**: Linux, macOS, or Windows with WSL

### Project Structure

```
website-cloner/
├── clone-website.js          # Main CLI entry point
├── lib/                      # Core libraries
│   ├── logger.js            # Logging utilities
│   ├── url-utils.js         # URL manipulation
│   ├── enumerator.js        # Phase 2: BFS enumeration
│   ├── downloader.js        # Phase 3: Asset downloads [TODO]
│   ├── link-rewriter.js     # Link rewriting [TODO]
│   ├── dynamic-detector.js  # Dynamic content detection [TODO]
│   └── s3-uploader.js       # S3 deployment [TODO]
├── docs/                     # Documentation
├── output/                   # Generated output (gitignored)
└── logs/                     # Execution logs (gitignored)
```

## Development Workflow

### 1. Before Starting Work

- Check existing issues and pull requests
- Create an issue for new features or bugs
- Update CHANGELOG.md with planned work

### 2. During Development

- Write clear commit messages following [Conventional Commits](https://www.conventionalcommits.org/)
- Update documentation as you go
- Add inline comments for complex logic
- Test your changes with real websites

### 3. Testing Changes

```bash
# Test enumeration phase
node clone-website.js --config=test-config.json --enumerate -v

# Verify output
cat output/manifest.json

# Check logs
tail -f logs/clone-*.log
```

### 4. Before Committing

- Run verification script: `bash verify.sh`
- Update CHANGELOG.md
- Ensure no credentials or sensitive data in code
- Check .gitignore is working

## Code Style

### JavaScript/Node.js

- Use ES modules (import/export)
- Use async/await for asynchronous code
- Prefer const over let, never use var
- Use descriptive variable names
- Add JSDoc comments for functions

Example:
```javascript
/**
 * Normalize URL for deduplication
 * @param {string} urlString - URL to normalize
 * @param {string} baseUrl - Base URL for relative resolution
 * @returns {string|null} Normalized URL or null if invalid
 */
export function normalizeUrl(urlString, baseUrl = null) {
  // Implementation
}
```

### Error Handling

- Always handle errors gracefully
- Log errors with context
- Don't swallow errors silently
- Provide helpful error messages

Example:
```javascript
try {
  const result = await riskyOperation();
} catch (error) {
  logger.error(`Failed to perform operation: ${error.message}`, {
    context: 'additional info'
  });
  // Handle or rethrow
}
```

### Logging

Use appropriate log levels:
- `error` - Fatal errors that prevent continuation
- `warn` - Non-fatal issues, degraded functionality
- `info` - General information about progress
- `debug` - Detailed debugging information
- `success` - Successful completion of operations

## Testing

### Manual Testing

Create test configurations for different scenarios:

```json
{
  "target": {"url": "https://example-site.com"},
  "crawling": {
    "maxDepth": 2,
    "maxPages": 10
  }
}
```

Test with:
- Simple static sites (example.com)
- Multi-page blogs
- Documentation sites
- Sites with dynamic content

### Automated Testing (Planned)

Future testing framework:
- Unit tests for utility functions
- Integration tests for crawling
- End-to-end tests with mock servers

## Documentation

### When to Update Docs

- New features → Update README.md and CHANGELOG.md
- Breaking changes → Update README.md with migration guide
- Bug fixes → Update CHANGELOG.md
- Configuration changes → Update config.example.json

### Documentation Standards

- Use clear, concise language
- Include code examples
- Provide expected output
- Link to related documentation

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

Examples:
```
feat(enumerator): add support for sitemap.xml parsing

Implement sitemap.xml detection and parsing to discover
additional URLs not linked from HTML pages.

Closes #42
```

```
fix(logger): handle log file write errors gracefully

Previously, log file write errors would crash the process.
Now they are caught and logged to console with a warning.

Fixes #38
```

## Changelog Updates

Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format:

### Categories
- `Added` - New features
- `Changed` - Changes to existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security vulnerabilities

### Example Entry
```markdown
## [0.2.0] - 2026-01-15

### Added
- Asset downloader with concurrency control
- Link rewriting for static hosting
- Progress bars with ora spinner

### Fixed
- URL normalization for query parameters
- Rate limiter token bucket overflow
```

## Release Process

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

### Release Checklist

1. Update version in package.json
2. Update CHANGELOG.md with version and date
3. Test thoroughly with verify.sh
4. Commit: `chore: release v0.2.0`
5. Tag: `git tag -a v0.2.0 -m "Release v0.2.0"`
6. Push: `git push && git push --tags`

## Getting Help

- Check existing issues and discussions
- Read the implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Review the code comments
- Ask questions in issues

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Report unacceptable behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
