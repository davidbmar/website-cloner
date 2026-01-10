#!/bin/bash

# Website Cloner - Verification Script
# Tests installation and basic functionality

# Don't exit on first error - we want to run all tests
set +e

echo "╔═══════════════════════════════════════════════╗"
echo "║     Website Cloner - Verification Tests     ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -ne "${BLUE}Testing:${NC} $test_name ... "

    if eval "$test_command" &> /dev/null; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
        return 1
    fi
}

# Run tests
echo "Running verification tests..."
echo ""

# Test 1: Node.js installed
run_test "Node.js installation" "command -v node"

# Test 2: npm installed
run_test "npm installation" "command -v npm"

# Test 3: Dependencies installed
run_test "node_modules exists" "[ -d node_modules ]"

# Test 4: CLI executable
run_test "CLI executable" "[ -x clone-website.js ]"

# Test 5: CLI help works
run_test "CLI --help works" "node clone-website.js --help"

# Test 6: Config example exists
run_test "config.example.json exists" "[ -f config.example.json ]"

# Test 7: All lib files exist
run_test "lib/logger.js exists" "[ -f lib/logger.js ]"
run_test "lib/url-utils.js exists" "[ -f lib/url-utils.js ]"
run_test "lib/enumerator.js exists" "[ -f lib/enumerator.js ]"

# Test 8: Output directory exists
run_test "output/ directory exists" "[ -d output ]"

# Test 9: Logs directory exists
run_test "logs/ directory exists" "[ -d logs ]"

# Test 10: README exists
run_test "README.md exists" "[ -f README.md ]"

# Test 11: Required npm packages
run_test "axios package installed" "npm list axios"
run_test "cheerio package installed" "npm list cheerio"
run_test "commander package installed" "npm list commander"

# Summary
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║            Verification Summary              ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo -e "Tests passed: ${GREEN}$PASSED${NC}"
echo -e "Tests failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Installation is good.${NC}"
    echo ""
    echo "Ready to use! Try:"
    echo "  node clone-website.js --config=config.example.json --enumerate"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please run setup.sh again.${NC}"
    exit 1
fi
