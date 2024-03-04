echo "STARTING"
COMPILE_DOCS="npx tsc --project docs-static/tsconfig.docs.json --moduleResolution node --target esNext && npx generate-docs --overridePath ./docs-static/typeOverride.json --input ./src-docs  --output ./docs-static/generated && rm -rf src-docs/**/*.doc.js src-docs/*.doc.js"
COMPILE_STATIC_PAGES="npx tsc docs-static/staticPages/*.doc.ts --moduleResolution node  --target esNext && npx generate-docs --isLandingPage --input ./docs-static/staticPages --output ./docs-static/generated && rm -rf docs-static/staticPages/*.doc.js"

if [ "$1" = "isTest" ];
then
COMPILE_DOCS="npx tsc --project docs-static/tsconfig.docs.json --moduleResolution node  --target esNext && npx generate-docs --overridePath ./docs-static/typeOverride.json --input ./src-docs --output ./docs-static/temp && rm -rf src-docs/**/*.doc.js src-docs/*.doc.js"
COMPILE_STATIC_PAGES="npx tsc docs-static/staticPages/*.doc.ts --moduleResolution node  --target esNext && npx generate-docs --isLandingPage --input ./docs-static/staticPages  --output ./docs-static/temp && rm -rf docs-static/staticPages/*.doc.js"
fi

echo $1
echo "RUNNING"
eval $COMPILE_DOCS
eval $COMPILE_STATIC_PAGES
echo "DONE"

if [ -n "$SPIN" ]; then
  if [ -n "$SPIN_SHOPIFY_DEV_SERVICE_FQDN" ]; then
    cp ./docs-static/generated/* ~/src/github.com/Shopify/shopify-dev/db/data/docs/templated_apis/shopify-cli/v3/
    cp ./docs-static/screenshots/* ~/src/github.com/Shopify/shopify-dev/app/assets/images/templated-apis-screenshots/shopify-cli/v3/
    # cd ~/src/github.com/Shopify/shopify-dev
    # restart
  else
    echo "If you include shopify-dev in your Spin constellation, this will automatically copy ./docs-static/generated to shopify-dev"
  fi
else
  echo "Not copying docs to shopify-dev because we're not in Spin"
fi
