echo "STARTING"
COMPILE_DOCS="npx tsc --project docs/tsconfig.docs.json --types react --moduleResolution node --target esNext && generate-docs --overridePath ./docs/typeOverride.json --input ./src-docs  --output ./docs/generated && rm -rf src-docs/**/*.doc.js src-docs/*.doc.js"
COMPILE_STATIC_PAGES="npx tsc docs/staticPages/*.doc.ts --types react --moduleResolution node  --target esNext && generate-docs --isLandingPage --input ./docs/staticPages --output ./docs/generated && rm -rf docs/staticPages/*.doc.js"

if [ "$1" = "isTest" ];
then
COMPILE_DOCS="yarn tsc --project docs/tsconfig.docs.json --types react --moduleResolution node  --target esNext && generate-docs --overridePath ./docs/typeOverride.json --input ./src-docs --output ./docs/temp && rm -rf src-docs/**/*.doc.js src-docs/*.doc.js"
COMPILE_STATIC_PAGES="yarn tsc docs/staticPages/*.doc.ts --types react --moduleResolution node  --target esNext && generate-docs --isLandingPage --input ./docs/staticPages  --output ./docs/temp && rm -rf docs/staticPages/*.doc.js"
fi

echo $1
echo "RUNNING"
eval $COMPILE_DOCS
eval $COMPILE_STATIC_PAGES
echo "DONE"

if [ -n "$SPIN" ]; then
  if [ -n "$SPIN_SHOPIFY_DEV_SERVICE_FQDN" ]; then
    cp ./docs/generated/* ~/src/github.com/Shopify/shopify-dev/db/data/docs/templated_apis/shopify-cli/v3/
    cp ./docs/screenshots/* ~/src/github.com/Shopify/shopify-dev/app/assets/images/templated-apis-screenshots/shopify-cli/v3/
    # cd ~/src/github.com/Shopify/shopify-dev
    # restart
  else
    echo "If you include shopify-dev in your Spin constellation, this will automatically copy ./docs/generated to shopify-dev"
  fi
else
  echo "Not copying docs to shopify-dev because we're not in Spin"
fi
