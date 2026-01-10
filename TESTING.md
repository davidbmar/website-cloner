# Testing Guide - Website Cloner

## What's Currently Working (v0.1.0)

✅ **Phase 2: URL Enumeration (Map Stage)**
- BFS crawling algorithm
- Rate limiting
- Robots.txt support
- Pattern matching (ignore/allow)
- Manifest generation
- CLI interface

❌ **Phase 3: Asset Extraction (Clone Stage)** - NOT YET IMPLEMENTED
- Asset downloading
- Link rewriting
- Dynamic content detection
- S3 upload

---

## Testing Phase 2 (URL Enumeration)

### Test 1: Simple Static Site ✅ READY TO TEST

**Goal:** Verify basic crawling works with a simple website

**Command:**
```bash
cd /home/ubuntu/src/website-cloner
node clone-website.js --config=test-config.json --enumerate -v
```

**What to Check:**
- [ ] Crawler starts successfully
- [ ] URLs are discovered
- [ ] manifest.json is created
- [ ] No errors in output
- [ ] Log file is created in logs/

**Expected Output:**
```
✓ Enumeration Complete!
Total URLs discovered: [some number]
Manifest saved to: output/manifest.json
```

**Verify manifest.json:**
```bash
cat output/manifest.json | head -20
```

---

### Test 2: Multi-Page Website 🧪 RECOMMENDED

**Goal:** Test with a real multi-page site

**Create test config:**
```bash
cp test-config.json blog-test-config.json
```

**Edit blog-test-config.json:**
```json
{
  "target": {
    "url": "https://blog.golang.org"
  },
  "crawling": {
    "maxDepth": 2,
    "maxPages": 20,
    "sameDomainOnly": true,
    "respectRobotsTxt": true
  }
}
```

**Run test:**
```bash
node clone-website.js --config=blog-test-config.json --enumerate -v
```

**What to Check:**
- [ ] Multiple URLs discovered (should be > 1)
- [ ] Depth levels are correct
- [ ] No crashes or errors
- [ ] Rate limiting works (check timing in verbose output)
- [ ] Logs show crawling progress

---

### Test 3: Robots.txt Compliance 🤖

**Goal:** Verify robots.txt is respected

**Test site with robots.txt:** Try a site like https://www.wikipedia.org

**Config:**
```json
{
  "target": {"url": "https://www.wikipedia.org"},
  "crawling": {
    "maxDepth": 1,
    "maxPages": 10,
    "respectRobotsTxt": true
  }
}
```

**What to Check:**
- [ ] "robots.txt loaded successfully" message appears
- [ ] Crawler respects disallowed paths
- [ ] Check logs for "Skipping ... (disallowed by robots.txt)"

---

### Test 4: Pattern Matching (Ignore Patterns) 🎯

**Goal:** Test that ignore patterns work

**Config:**
```json
{
  "target": {"url": "https://github.com"},
  "crawling": {
    "maxDepth": 1,
    "maxPages": 20,
    "sameDomainOnly": true,
    "ignorePatterns": [
      "**/login",
      "**/signup",
      "**/logout"
    ]
  }
}
```

**What to Check:**
- [ ] Login/signup URLs are NOT in manifest
- [ ] Debug logs show: "Skipping ... (matches ignore pattern)"

---

### Test 5: Rate Limiting ⏱️

**Goal:** Verify rate limiting prevents server overload

**Config with aggressive rate limit:**
```json
{
  "target": {"url": "https://example.com"},
  "crawling": {"maxDepth": 2, "maxPages": 50},
  "rateLimit": {
    "enabled": true,
    "requestsPerSecond": 1
  }
}
```

**What to Check:**
- [ ] Requests are spaced out (observe timing in verbose mode)
- [ ] No "too many requests" errors
- [ ] Progress is slower than without rate limiting

**Test without rate limiting:**
```json
{
  "rateLimit": {"enabled": false}
}
```

Should be noticeably faster.

---

### Test 6: Error Handling 🛑

**Goal:** Verify graceful handling of errors

**Test Cases:**

**A. Invalid URL**
```bash
# Edit config with invalid URL
"target": {"url": "https://this-does-not-exist-12345.com"}
```

**Expected:** Error message, but no crash

**B. Network Timeout**
```json
{
  "network": {"timeout": 1}  // 1ms timeout - will fail
}
```

**Expected:** Retry logic kicks in, eventually fails gracefully

**C. Non-HTML Content**
```json
{
  "target": {"url": "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"}
}
```

**Expected:** "Skipping non-HTML content" message

---

### Test 7: Depth Control 📊

**Goal:** Verify maxDepth is respected

**Config:**
```json
{
  "target": {"url": "https://golang.org"},
  "crawling": {
    "maxDepth": 3,
    "maxPages": 100
  }
}
```

**Verify manifest:**
```bash
cat output/manifest.json | grep -A 10 '"byDepth"'
```

**What to Check:**
- [ ] No URLs at depth > 3
- [ ] byDepth object shows levels 0, 1, 2, 3 (no higher)

---

### Test 8: Same Domain Restriction 🌐

**Goal:** Ensure crawler doesn't follow external links

**Config:**
```json
{
  "target": {"url": "https://news.ycombinator.com"},
  "crawling": {
    "maxDepth": 1,
    "maxPages": 20,
    "sameDomainOnly": true
  }
}
```

**Verify manifest:**
```bash
cat output/manifest.json | grep '"url"' | grep -v 'news.ycombinator.com'
```

**Expected:** No results (all URLs should be from news.ycombinator.com)

---

## Testing Checklist

### Basic Functionality
- [ ] Test 1: Simple static site (example.com)
- [ ] Test 2: Multi-page website
- [ ] Test 3: Robots.txt compliance
- [ ] Test 4: Ignore patterns work
- [ ] Test 5: Rate limiting functions
- [ ] Test 6: Error handling (invalid URLs, timeouts)
- [ ] Test 7: Depth control works
- [ ] Test 8: Same domain restriction

### Edge Cases
- [ ] Empty website (single page)
- [ ] Website with no links
- [ ] Website with circular links (A→B→A)
- [ ] Website with many subdomains
- [ ] Website with query parameters
- [ ] Website with fragments (#anchors)

### Performance
- [ ] Handles 100+ pages
- [ ] Handles 500+ pages
- [ ] Rate limiting prevents server overload
- [ ] Memory usage is reasonable

### Logging
- [ ] Logs are created in logs/
- [ ] Log file contains useful information
- [ ] Verbose mode shows detailed output
- [ ] Progress updates work correctly

---

## Quick Test Suite

Run all basic tests in sequence:

```bash
#!/bin/bash
cd /home/ubuntu/src/website-cloner

echo "Test 1: Simple site..."
node clone-website.js --config=test-config.json --enumerate
echo ""

echo "Test 2: Multi-page site..."
cat > test2.json << 'EOF'
{
  "target": {"url": "https://blog.golang.org"},
  "crawling": {"maxDepth": 2, "maxPages": 20, "sameDomainOnly": true},
  "rateLimit": {"enabled": true, "requestsPerSecond": 2},
  "output": {"localDirectory": "./output"},
  "logging": {"level": "info", "logToFile": true}
}
EOF
node clone-website.js --config=test2.json --enumerate
echo ""

echo "Test 3: Depth control..."
cat > test3.json << 'EOF'
{
  "target": {"url": "https://example.com"},
  "crawling": {"maxDepth": 1, "maxPages": 10, "sameDomainOnly": true},
  "rateLimit": {"enabled": false},
  "output": {"localDirectory": "./output"},
  "logging": {"level": "info"}
}
EOF
node clone-website.js --config=test3.json --enumerate
echo ""

echo "All tests complete!"
```

---

## After Testing Phase 2

Once Phase 2 tests pass, we need to implement **Phase 3**:

### Next Implementation Tasks

1. **lib/downloader.js** - Download HTML and assets
2. **lib/link-rewriter.js** - Rewrite URLs for static hosting
3. **lib/dynamic-detector.js** - Mark dynamic content
4. **lib/s3-uploader.js** - Upload to S3

### Phase 3 Testing (Future)

Will test:
- [ ] Assets are downloaded correctly
- [ ] Links are rewritten to relative paths
- [ ] CSS url() references are rewritten
- [ ] Dynamic content is detected and marked
- [ ] S3 upload works with correct Content-Types
- [ ] Static site works in browser

---

## Recommended Test Websites

**Simple (good for initial testing):**
- https://example.com - Single page
- https://info.cern.ch - Classic simple site

**Multi-page (good for thorough testing):**
- https://blog.golang.org - Blog with multiple posts
- https://golang.org/doc/ - Documentation site
- https://httpbin.org - HTTP testing service

**Complex (advanced testing):**
- https://news.ycombinator.com - Many links, simple HTML
- https://www.wikipedia.org - Large site, robots.txt

**DO NOT test on:**
- Social media sites (too many links, rate limiting issues)
- Sites with login requirements
- Sites with aggressive bot detection
- Sites with legal restrictions on scraping

---

## Success Criteria

Phase 2 is working correctly if:
1. ✅ Can enumerate URLs from multiple test sites
2. ✅ Respects maxDepth and maxPages limits
3. ✅ Generates valid manifest.json
4. ✅ Handles errors gracefully
5. ✅ Rate limiting prevents server overload
6. ✅ Robots.txt is respected when enabled
7. ✅ Ignore patterns filter correctly
8. ✅ Same domain restriction works

---

**Ready to test?** Start with Test 1 (simple site) and work your way through!
