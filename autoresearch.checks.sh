#!/bin/bash
set -euo pipefail

# Type check the packages we modify
cd packages/cli && pnpm tsc --noEmit 2>&1 | grep -i error || true
cd ../..

cd packages/cli-kit && pnpm tsc --noEmit 2>&1 | grep -i error || true
cd ../..

# Run tests for the CLI package (fast subset)
pnpm --filter @shopify/cli vitest run --reporter=dot 2>&1 | tail -20

# Verify the CLI actually works - version command
node packages/cli/bin/dev.js version 2>&1 | grep -q "3\." || { echo "ERROR: version command failed"; exit 1; }
