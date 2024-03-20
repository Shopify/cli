echo "STARTING"
COMPILE_DOCS="npx tsc --project bin/docs/tsconfig.docs.json --moduleResolution node --target esNext && npx generate-docs --overridePath ./bin/docs/typeOverride.json --input ./docs-shopify.dev/commands  --output ./docs-shopify.dev/generated && rm -rf docs-shopify.dev/commands/**/*.doc.js docs-shopify.dev/commands/*.doc.js"
COMPILE_STATIC_PAGES="npx tsc docs-shopify.dev/static/*.doc.ts --moduleResolution node  --target esNext && npx generate-docs --isLandingPage --input ./docs-shopify.dev/static --output ./docs-shopify.dev/generated && rm -rf docs-shopify.dev/static/*.doc.js"

if [ "$1" = "isTest" ];
then
COMPILE_DOCS="npx tsc --project bin/docs/tsconfig.docs.json --moduleResolution node  --target esNext && npx generate-docs --overridePath ./bin/docs/typeOverride.json --input ./docs-shopify.dev/commands --output ./docs-shopify.dev/static/temp && rm -rf docs-shopify.dev/commands/**/*.doc.js docs-shopify.dev/commands/*.doc.js"
COMPILE_STATIC_PAGES="npx tsc docs-shopify.dev/static/*.doc.ts --moduleResolution node  --target esNext && npx generate-docs --isLandingPage --input ./docs-shopify.dev/static/docs-shopify.dev  --output ./docs-shopify.dev/static/temp && rm -rf docs-shopify.dev/static/*.doc.js"
fi

echo $1
echo "RUNNING"
eval $COMPILE_DOCS
eval $COMPILE_STATIC_PAGES
echo "DONE"

if [ -n "$SPIN" ]; then
  if [ -n "$SPIN_SHOPIFY_DEV_SERVICE_FQDN" ]; then
    cp ./docs-shopify.dev/static/generated/* ~/src/github.com/Shopify/shopify-dev/db/data/docs/templated_apis/shopify-cli/v3/
    cp ./docs-shopify.dev/static/screenshots/* ~/src/github.com/Shopify/shopify-dev/app/assets/images/templated-apis-screenshots/shopify-cli/v3/
    # cd ~/src/github.com/Shopify/shopify-dev
    # restart
  else
    echo "If you include shopify-dev in your Spin constellation, this will automatically copy ./docs-shopify.dev/generated to shopify-dev"
  fi
else
  echo "Not copying docs to shopify-dev because we're not in Spin"
fi
