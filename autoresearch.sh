#!/bin/bash
set -euo pipefail

# Clean previous dist
rm -rf packages/cli/dist

# Bundle
pnpm bundle-for-release 2>&1 | tail -3

# Measure sizes
total_kb=$(du -sk packages/cli/dist | awk '{print $1}')
js_kb=$(find packages/cli/dist -name "*.js" -type f -exec du -sk {} + | awk '{s+=$1}END{print s}')
maps_kb=$(find packages/cli/dist -name "*.map" -type f -exec du -sk {} + | awk '{s+=$1}END{print s}')
assets_kb=$((total_kb - js_kb - maps_kb))

echo "METRIC bundle_kb=$total_kb"
echo "METRIC js_kb=$js_kb"
echo "METRIC maps_kb=$maps_kb"
echo "METRIC assets_kb=$assets_kb"
