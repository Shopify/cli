# Checkout UI Extension

Checkout UI extensions let app developers build custom functionality that merchants can install at defined points in the checkout flow. You can learn more about checkout UI extensions in Shopify’s [developer documentation](https://shopify.dev/api/checkout-extensions/checkout).


## Prerequisites
---
Make sure you've completed the following prerequisites to develop a Checkout UI extension:

* You have a [Partner Account](https://www.shopify.com/partners).
* You created a [Development Store](https://shopify.dev/apps/tools/development-stores) and [enabled the developer preview](https://shopify.dev/api/release-notes/developer-previews#previewing-new-features) for checkout UI extensions.
* Your store is populated with [test products](https://shopify.dev/apps/getting-started/create#step-4-add-and-publish-products-to-your-development-store-for-testing).
* You have an [ngrok account](https://ngrok.com/) and [auth token](https://dashboard.ngrok.com/auth/your-authtoken).
    * This is used to preview apps that contain UI extensions with Shopify CLI. More info inthe [ngrok’s documentation](https://ngrok.com/docs#config).
* You’ve [Created](https://shopify.dev/apps/checkout/custom-banners/getting-started#step-1-generate-a-new-extension) a [Checkout UI extension](https://shopify.dev/api/checkout-extensions/checkout) that you can [Preview](https://shopify.dev/apps/checkout/custom-banners/getting-started#step-2-preview-your-extension) and [Deploy](https://shopify.dev/apps/checkout/custom-banners/getting-started#step-3-deploy-the-extension).

## Tutorials
---
The best way to get started is to follow some of the available Extension Tutorials:


For creating an extension:
* [Enable Extended Delivery Instructions](https://shopify.dev/apps/checkout/delivery-instructions) - Static Renderer
* [Adding Product Offer Recommendations](https://shopify.dev/apps/checkout/product-offers) - Static Renderer
* [Creating a Custom Banner](https://shopify.dev/apps/checkout/custom-banners) - Dynamic Renderer

To add specific features to an extension
* [Adding Field Validation](https://shopify.dev/apps/checkout/validation)
* [How to Localize an extension](https://shopify.dev/apps/checkout/localize-ui-extensions)


## Getting Started
---
Initially, your extension will look like the following:

```
└── my-app
  └── extensions
    └── my-checkout-ui-extension
        ├── src
        │   └── index.jsx OR index.js // The index page of the checkout UI extension
        ├── locales
        │   ├── en.default.json // The default locale for the checkout UI extension
        │   └── fr.json // The locale file for non-regional French translations
        └── shopify.ui.extension.toml // The config file for the checkout UI extension

```

Start writing code for your extension simply editing the `src/index.js` file (or equivalent file extension of your choice).

> By default, the Checkout UI Extension is preconfigured as a [`Dynamic Extension Point`](https://shopify.dev/api/checkout-extensions/checkout#extension-points).
> You can change it to your desired Extension Point location.


To shape your extension you have the following collection of tools available:
* [UI Components](https://shopify.dev/api/checkout-extensions/checkout/components)
* [Shopify APIs](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api).

With these tools you'll get access to Shopify-enabled resources (such as [Analytics](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#analytics), [Localization](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#localization) or [Storage](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#storage)) and the frameworks that you need to read (and mutate) data for your Checkout-UI extension (like Shop, Customer, CartLine, MetaFields, etc.).

> If you are using React, there is also a large collection of [React Hooks available](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#react-hooks) to ease access to these operations, otherwise you'll need to manually subscribe to the subscribable value directly with a callback.

## FAQ
---
* **How can I preview my extension**

    Depending on your extension location they may be either `dynamic` or `static` renderers, which diferr slightly on the process to place them for testing.
    - `Dynamic renderers`: Using a [query string parameter](https://shopify.dev/apps/checkout/test-ui-extensions#dynamic-extension-points) at the end of the URL you can place your renderer in the desired renderer point.
    - `Static renderer`: No special work is required here, just note that a static renders is shown only if the section that they are attached to is enabled.

* **How can I change my extension renderer type?**

    To change your extension render type, be mindful that you have to change it in the following places:
    1. In your `script file`, where you declared the extension (will be either _render()_ or _extend()_), you'll have to change the declared Extension Point.
    2. In your `settings TOML file` (shopify.ui.extension.toml) you'll have to change the `extension_points` declaration for your new desired type.

## Useful Links
---

- [Checkout app documentation](https://shopify.dev/apps/checkout)

- [Checkout UI extension documentation](https://shopify.dev/api/checkout-extensions)
  - [Configuration](https://shopify.dev/api/checkout-extensions/checkout/configuration)
  - [API Reference](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api)
  - [UI Components](https://shopify.dev/api/checkout-extensions/checkout/components)
  - [Available React Hooks](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#react-hooks)
