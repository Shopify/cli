#!/bin/bash
set -euo pipefail

# Type check
echo "Running type-check..."
pnpm type-check 2>&1 | tail -5

# Lint
echo "Running lint..."
pnpm lint 2>&1 | tail -5

# Unit tests
echo "Running tests..."
pnpm test:unit 2>&1 | tail -10
