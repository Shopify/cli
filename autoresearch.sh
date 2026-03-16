#!/bin/bash
set -euo pipefail

# Run vitest and capture output
OUTPUT=$(pnpm vitest run 2>&1) || true

# Extract the Duration line
DURATION_LINE=$(echo "$OUTPUT" | grep 'Duration' | tail -1)

# Parse wall clock time (first number after Duration)
WALL=$(echo "$DURATION_LINE" | grep -oE '[0-9]+\.[0-9]+' | head -1)

# Parse sub-metrics
TRANSFORM=$(echo "$DURATION_LINE" | grep -oE 'transform [0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+')
SETUP=$(echo "$DURATION_LINE" | grep -oE 'setup [0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+')
COLLECT=$(echo "$DURATION_LINE" | grep -oE 'collect [0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+')
TESTS=$(echo "$DURATION_LINE" | grep -oE 'tests [0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+')
PREPARE=$(echo "$DURATION_LINE" | grep -oE 'prepare [0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+')

# Check pass/fail - "Tests" line (not "Test Files")
TESTS_LINE=$(echo "$OUTPUT" | grep 'Tests' | grep -v 'Test Files' | tail -1)
PASSED=$(echo "$TESTS_LINE" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo "0")
FAILED=$(echo "$TESTS_LINE" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' || echo "0")

# Test files count
FILES_LINE=$(echo "$OUTPUT" | grep 'Test Files' | tail -1)
FILES_PASSED=$(echo "$FILES_LINE" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo "0")

echo "METRIC wall_clock_s=$WALL"
echo "METRIC collect_s=$COLLECT"
echo "METRIC tests_s=$TESTS"
echo "METRIC transform_s=$TRANSFORM"
echo "METRIC setup_s=$SETUP"
echo "METRIC prepare_s=$PREPARE"
echo "METRIC passed=$PASSED"
echo "METRIC failed=$FAILED"
echo "METRIC files_passed=$FILES_PASSED"

# Fail if not enough tests passed
if [[ -z "$PASSED" || "$PASSED" -lt 3700 ]]; then
  echo "ERROR: Expected 3700+ passing tests, got ${PASSED:-0}"
  exit 1
fi
