This package contains a Shopify CLI plugin that enables the creation of ngrok tunnels from `shopify app dev`, 
allowing previews from any device.

## Requirements

- Shopify CLI
- [ngrok](https://dashboard.ngrok.com/signup) account

## Installation

Right now, it's installed by default with the Shopify CLI. But it could be manually installed with:

```bash
shopify plugins install ngrok
```

## Usage

When you serve your app, it will automatically create an ngrok tunnel and update your app configuration
in the Partners dashboard to point to the new URL:

```bash
shopify app dev
```

If you don't have an ngrok account configured, the first time it will ask for the token.
You can get it from the [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken).
Also, you can use this command to manually update it:
```bash
shopify tunnel auth <TOKEN>
```

## Run tests

```bash
yarn test
```

or

```bash
npm test
```