#!/bin/bash

# Automated Test Suite for Phase 2 (URL Enumeration)

echo "╔═══════════════════════════════════════════════╗"
echo "║     Website Cloner - Test Suite             ║"
echo "║     Phase 2: URL Enumeration Tests          ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

run_test() {
    local test_name="$1"
    local config_file="$2"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Running: $test_name${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

    if node clone-website.js --config="$config_file" --enumerate; then
        echo ""
        echo -e "${GREEN}✓ PASS: $test_name${NC}"
        ((PASSED++))

        # Show manifest summary
        if [ -f output/manifest.json ]; then
            TOTAL_URLS=$(cat output/manifest.json | grep '"totalUrls"' | grep -o '[0-9]*')
            echo -e "  URLs discovered: $TOTAL_URLS"
        fi
    else
        echo ""
        echo -e "${RED}✗ FAIL: $test_name${NC}"
        ((FAILED++))
    fi

    sleep 2
}

# Create test directory
mkdir -p test-configs
cd /home/ubuntu/src/website-cloner

echo "Preparing test configurations..."
echo ""

# Test 1: Simple Static Site
cat > test-configs/test1-simple.json << 'EOF'
{
  "target": {"url": "https://example.com", "description": "Test 1: Simple static site"},
  "crawling": {"maxDepth": 1, "maxPages": 10, "sameDomainOnly": true, "respectRobotsTxt": false, "ignorePatterns": [], "allowedPatterns": []},
  "assets": {"downloadImages": true, "downloadCSS": true, "downloadJS": true, "downloadFonts": true, "downloadVideos": false, "maxFileSize": 10485760},
  "dynamic": {"detectAPIEndpoints": true, "detectFormSubmissions": true, "detectWebSockets": true, "detectEmptyDivs": true, "markerAttribute": "data-marker", "markerValue": "LLM_FIX_REQUIRED", "generateManifest": true},
  "network": {"concurrency": 3, "retryAttempts": 2, "retryDelay": 1000, "timeout": 15000, "userAgent": "Mozilla/5.0 (compatible; WebsiteCloner/1.0 Test)", "headers": {}, "cookies": []},
  "rateLimit": {"enabled": true, "requestsPerSecond": 3, "burstSize": 5},
  "output": {"localDirectory": "./output", "preserveDirectoryStructure": true, "cleanBeforeRun": false},
  "s3": {"enabled": false},
  "logging": {"level": "info", "logToFile": true, "logDirectory": "./logs", "progressUpdates": true}
}
EOF

# Test 2: Depth Control
cat > test-configs/test2-depth.json << 'EOF'
{
  "target": {"url": "https://info.cern.ch", "description": "Test 2: Depth control"},
  "crawling": {"maxDepth": 2, "maxPages": 20, "sameDomainOnly": true, "respectRobotsTxt": false},
  "network": {"timeout": 20000, "userAgent": "Mozilla/5.0 (compatible; WebsiteCloner/1.0 Test)"},
  "rateLimit": {"enabled": true, "requestsPerSecond": 2},
  "output": {"localDirectory": "./output"},
  "s3": {"enabled": false},
  "logging": {"level": "info", "logToFile": true}
}
EOF

# Test 3: Rate Limiting
cat > test-configs/test3-ratelimit.json << 'EOF'
{
  "target": {"url": "https://example.com", "description": "Test 3: Rate limiting"},
  "crawling": {"maxDepth": 1, "maxPages": 5, "sameDomainOnly": true},
  "network": {"timeout": 15000, "userAgent": "Mozilla/5.0 (compatible; WebsiteCloner/1.0 Test)"},
  "rateLimit": {"enabled": true, "requestsPerSecond": 1, "burstSize": 2},
  "output": {"localDirectory": "./output"},
  "s3": {"enabled": false},
  "logging": {"level": "info", "logToFile": true}
}
EOF

echo "Running tests..."
echo ""

# Run tests
run_test "Test 1: Simple Static Site" "test-configs/test1-simple.json"
run_test "Test 2: Depth Control (2 levels)" "test-configs/test2-depth.json"
run_test "Test 3: Rate Limiting" "test-configs/test3-ratelimit.json"

# Summary
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║              Test Summary                    ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo -e "Tests passed: ${GREEN}$PASSED${NC}"
echo -e "Tests failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Phase 2 (URL Enumeration) is working correctly."
    echo ""
    echo "Next steps:"
    echo "  1. Review output/manifest.json"
    echo "  2. Check logs/ for detailed logs"
    echo "  3. Ready to implement Phase 3 (downloading, link rewriting)"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Review logs in logs/ directory for details"
    exit 1
fi
