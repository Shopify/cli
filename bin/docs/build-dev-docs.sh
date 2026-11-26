#!/bin/bash
set -e

pnpm exec generate-docs \
  --input ./docs-shopify.dev/commands/interfaces \
  --output ./docs-shopify.dev/generated

# Copy generated v2 docs to shopify-dev in the world repo if available: the World tree this
# checkout is in, else the root World tree of a standalone checkout. A World tree without the
# shopify-dev zone skips the copy, so it never writes into another tree.
WORLD_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$WORLD_ROOT" ] && [ -f "$WORLD_ROOT/.meta/manifest.json" ]; then
  if [ ! -d "$WORLD_ROOT/areas/platforms/shopify-dev" ]; then
    echo "Skipped copying generated_docs_data_v2.json: this World tree has no shopify-dev zone (add it from here with: tec checkout add ../shopify-dev)"
    exit 0
  fi
else
  WORLD_ROOT="$HOME/world/trees/root/src"
fi
WORLD_DEST="$WORLD_ROOT/areas/platforms/shopify-dev/db/data/docs/templated_apis/shopify_cli"
if [ -d "$WORLD_DEST" ]; then
  if [ -f "./docs-shopify.dev/generated/generated_docs_data_v2.json" ]; then
    cp "./docs-shopify.dev/generated/generated_docs_data_v2.json" "$WORLD_DEST/generated_docs_data_v2.json"
    echo "Copied generated_docs_data_v2.json to $WORLD_DEST"
  fi
fi
