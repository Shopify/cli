# The extension dev console

A tool for developing extensions locally.

## Local development

In terminal 1:

1. `dev cd cli`
2. `bin/create-test-app.js -e ui`
4. Copy the **Shopify extension dev console URL** e.g: `https://d1b8-2a09-bac1-14c0-188-00-b-224.ngrok.io/extensions/dev-console`

In terminal 2:

1. `dev cd cli`
2. `cd packages/ui-extensions-dev-console`
3. `VITE_CONNECTION_URL=[SHOPIFY_EXTENSION_DEV_CONSOLE_URL] yarn dev`

Go to: localhost:3000

### Limitations

When you run `yarn dev` a version of the dev console will be run, which is served from a static build.  If you go to a preview URL Shopify web will load the dev console from this URL, rather than the vite dev server which is on localhost:3000.

If you want to see your changes on Shopify web:

1. `dev cd cli`
2. `cd packages/ui-extensions-dev-console`
3. `yarn build`
