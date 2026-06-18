#!/bin/bash
set -e

pnpm exec generate-docs \
  --input ./docs-shopify.dev/commands/interfaces \
  --output ./docs-shopify.dev/generated

# Copy generated docs to shopify-dev in the world repo if available
WORLD_ROOT="$HOME/world/trees/root/src/areas/platforms/shopify-dev"
WORLD_DEST="$WORLD_ROOT/db/data/docs/templated_apis/shopify_cli"
if [ -d "$WORLD_DEST" ]; then
  if [ -f "./docs-shopify.dev/generated/generated_docs_data_v2.json" ]; then
    cp "./docs-shopify.dev/generated/generated_docs_data_v2.json" "$WORLD_DEST/generated_docs_data_v2.json"
    echo "Copied generated_docs_data_v2.json to $WORLD_DEST"
  fi
fi

CONTENT_SRC="./docs-shopify.dev/content/api/shopify-cli"
CONTENT_DEST="$WORLD_ROOT/content/api/shopify-cli"
if [ -d "$CONTENT_SRC" ] && [ -d "$CONTENT_DEST" ]; then
  cp "$CONTENT_SRC/sidebar.yml" "$CONTENT_DEST/sidebar.yml"
  for section in app theme hydrogen store general-commands; do
    if [ -d "$CONTENT_SRC/$section" ]; then
      rm -rf "$CONTENT_DEST/$section"
      mkdir -p "$CONTENT_DEST/$section"
      cp -R "$CONTENT_SRC/$section/." "$CONTENT_DEST/$section/"
    fi
  done
  echo "Copied generated Shopify CLI MDX content to $CONTENT_DEST"
fi

EXAMPLES_SRC="./docs-shopify.dev/examples/templated-apis/shopify-cli"
EXAMPLES_DEST="$WORLD_ROOT/db/examples/templated-apis/shopify-cli"
if [ -d "$EXAMPLES_SRC" ] && [ -d "$EXAMPLES_DEST" ]; then
  find "$EXAMPLES_SRC" -mindepth 1 -maxdepth 1 -type d | while read -r example_dir; do
    example_name="$(basename "$example_dir")"
    rm -rf "$EXAMPLES_DEST/$example_name"
    cp -R "$example_dir" "$EXAMPLES_DEST/"
  done
  echo "Copied generated Shopify CLI examples to $EXAMPLES_DEST"
fi
