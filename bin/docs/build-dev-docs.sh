echo "STARTING"
COMPILE_DOCS="npx tsc --project bin/docs/tsconfig.docs.json --moduleResolution node --target esNext && npx generate-docs --overridePath ./bin/docs/typeOverride.json --input ./docs-shopify.dev/commands  --output ./docs-shopify.dev/generated && rm -rf docs-shopify.dev/commands/**/*.doc.js docs-shopify.dev/commands/*.doc.js"
COMPILE_STATIC_PAGES="npx tsc docs-shopify.dev/static/*.doc.ts --moduleResolution node  --target esNext && npx generate-docs --isLandingPage --input ./docs-shopify.dev/static --output ./docs-shopify.dev/generated && rm -rf docs-shopify.dev/static/*.doc.js"
COMPILE_CATEGORY_PAGES="npx tsc docs-shopify.dev/categories/*.doc.ts --moduleResolution node  --target esNext && generate-docs --isCategoryPage --input ./docs-shopify.dev/categories --output ./docs-shopify.dev/generated && rm -rf docs-shopify.dev/categories/*.doc.js"

if [ "$1" = "isTest" ];
then
COMPILE_DOCS="npx tsc --project bin/docs/tsconfig.docs.json --moduleResolution node  --target esNext && npx generate-docs --overridePath ./bin/docs/typeOverride.json --input ./docs-shopify.dev/commands --output ./docs-shopify.dev/static/temp && rm -rf docs-shopify.dev/commands/**/*.doc.js docs-shopify.dev/commands/*.doc.js"
COMPILE_STATIC_PAGES="npx tsc docs-shopify.dev/static/*.doc.ts --moduleResolution node  --target esNext && npx generate-docs --isLandingPage --input ./docs-shopify.dev/static/docs-shopify.dev  --output ./docs-shopify.dev/static/temp && rm -rf docs-shopify.dev/static/*.doc.js"
fi

echo $1
echo "RUNNING"
eval $COMPILE_DOCS
eval $COMPILE_STATIC_PAGES
eval $COMPILE_CATEGORY_PAGES
echo "DONE"

# Copy generated docs to shopify-dev in the world repo if available
WORLD_DEST="$HOME/world/trees/root/src/areas/platforms/shopify-dev/db/data/docs/templated_apis/shopify_cli"
if [ -d "$WORLD_DEST" ]; then
  for file in generated_docs_data.json generated_docs_data_v2.json generated_static_pages.json generated_category_pages.json; do
    if [ -f "./docs-shopify.dev/generated/$file" ]; then
      cp "./docs-shopify.dev/generated/$file" "$WORLD_DEST/$file"
      echo "Copied $file to $WORLD_DEST"
    fi
  done
fi
