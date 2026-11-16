#!/bin/bash
set -e

pnpm exec generate-docs \
  --input ./docs-shopify.dev/commands/interfaces \
  --output ./docs-shopify.dev/generated

# Copy generated v2 docs to shopify-dev in the world repo if available: the World tree this
# checkout is in, else the root World tree of a standalone checkout.
WORLD_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$WORLD_ROOT" ] || [ ! -d "$WORLD_ROOT/areas/platforms/shopify-dev" ]; then
  WORLD_ROOT="$HOME/world/trees/root/src"
fi
WORLD_DEST="$WORLD_ROOT/areas/platforms/shopify-dev/db/data/docs/templated_apis/shopify_cli"
if [ -d "$WORLD_DEST" ]; then
  if [ -f "./docs-shopify.dev/generated/generated_docs_data_v2.json" ]; then
    cp "./docs-shopify.dev/generated/generated_docs_data_v2.json" "$WORLD_DEST/generated_docs_data_v2.json"
    echo "Copied generated_docs_data_v2.json to $WORLD_DEST"
  fi
fi
