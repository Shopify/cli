#!/bin/bash
set -euo pipefail

# Type check (covers correctness)
echo "Running type-check..."
pnpm type-check 2>&1 | tail -5

# Unit tests
echo "Running tests..."
pnpm test:unit 2>&1 | tail -10

# Note: lint skipped — pre-existing Node.js SIGABRT crash on eslint in this environment
