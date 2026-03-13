#!/bin/bash
set -euo pipefail

# Ensure build is up to date
pnpm nx build cli 2>&1 | tail -1

# Warmup run (filesystem cache)
node packages/cli/bin/dev.js version > /dev/null 2>&1

# Benchmark: median of 5 runs
times=()
for i in 1 2 3 4 5; do
  t=$( { /usr/bin/time -p node packages/cli/bin/dev.js version > /dev/null; } 2>&1 | awk '/^real/{print $2}' )
  # Convert to ms
  ms=$(echo "$t * 1000" | bc | cut -d. -f1)
  times+=("$ms")
done

# Sort and take median
IFS=$'\n' sorted=($(sort -n <<<"${times[*]}")); unset IFS
median=${sorted[2]}

echo "METRIC total_ms=$median"

# Also measure just the import time
import_ms=$(node -e "
const s = performance.now();
import('./packages/cli/bin/dev.js').then(() => {});
process.on('exit', () => console.log((performance.now() - s).toFixed(0)));
" 2>/dev/null)
echo "METRIC import_ms=$import_ms"
