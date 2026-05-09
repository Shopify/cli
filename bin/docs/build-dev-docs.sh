#!/bin/bash
set -e

pnpm exec generate-docs \
  --input ./docs-shopify.dev/commands/interfaces \
  --output ./docs-shopify.dev/generated

# Copy generated v2 docs to shopify-dev in the world repo if available
WORLD_DEST="$HOME/world/trees/root/src/areas/platforms/shopify-dev/db/data/docs/templated_apis/shopify_cli"
if [ -d "$WORLD_DEST" ]; then
  if [ -f "./docs-shopify.dev/generated/generated_docs_data_v2.json" ]; then
    cp "./docs-shopify.dev/generated/generated_docs_data_v2.json" "$WORLD_DEST/generated_docs_data_v2.json"
    echo "Copied generated_docs_data_v2.json to $WORLD_DEST"
  fi
fi
