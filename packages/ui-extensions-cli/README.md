# Shopify CLI Extensions

The Shopify CLI Extensions command line tool allows you to build a UI Extensions. It comes packaged with [Shopify CLI](https://shopify.github.io/shopify-app-cli/core), so when you create an extension using Shopify CLI's `shopify extension create` command, your project will automatically consume this package.

Start using this tool by creating an extension with [Shopify CLI](https://shopify.github.io/shopify-app-cli/core/#create)

## Installation

When consumed in a project, the command `shopify-cli-extensions` becomes available to the project. The command can be used to build UI Extensions.

To install this package in an UI Extension project, run:

```sh
npm install @shopify/shopify-cli-extensions
```

or

```sh
yarn add @shopify/shopify-cli-extensions
```

## Building a UI Extension for development

You can run the `shopify-cli-extensions serve` to build your extension and automatically trigger a re-build when the source files are changed.

```sh
npm shopify-cli-extensions serve
```

or

```sh
yarn shopify-cli-extensions serve
```

## Building a UI Extension for production

You can run the `shopify-cli-extensions build` to build a minified version of your extension.

```sh
npm shopify-cli-extensions build
```

or

```sh
yarn shopify-cli-extensions build
```

## Getting the extension config

If you are using your own build tools, you can get access to the extension configs by using the `getConfigs` utility provided. This utility will read your extension config and return a JSON object.

```js
import {getConfigs} from '@shopify/shopify-cli-extensions';

const configs = getConfigs();

// TODO: do something with the configs
```
