# Checkout-UI extension README

Checkout UI extensions let app developers build custom functionality that merchants can install at defined points in the checkout flow. [More info](https://shopify.dev/api/checkout-extensions/checkout)


## Prerequisites
---
Make sure to complete [all the prerequisites](https://shopify.dev/apps/checkout/delivery-instructions/getting-started#requirements) from any tutorials to develop a Checkout UI extension.


## Tutorials
---
The best way to get started is to follow some of the available Extension Tutorials:


For creating an extension:
* [Enable extended delivery instructions](https://shopify.dev/apps/checkout/delivery-instructions)
* [Adding product offer recommendations](https://shopify.dev/apps/checkout/product-offers)
* [Creating a custom banner](https://shopify.dev/apps/checkout/custom-banners)

To add specific features to an extension
* [Adding field validation](https://shopify.dev/apps/checkout/validation)
* [Localizing an exstension](https://shopify.dev/apps/checkout/localize-ui-extensions)


## Getting Started
---
Initially, your extension will have the following files:

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

You can customize your new extension by editing the code in the `src/index.js` or `src/index.jsx` file.

> By default, your extension is configured to target the `Checkout::Dynamic::Render` [extension point](https://shopify.dev/api/checkout-extensions/checkout#extension-points). This extension point does not have a single location in the checkout where it will appear; instead, a merchant installing your extension will configure where *they* want your extension to show up.
> If you are building an extension that is tied to existing UI element in the checkout, such as the cart lines or shipping method, you can change the extension point so that your UI extension will render in the correct location. Check out the list of [all available extension points](https://shopify.dev/api/checkout-extensions/checkout#extension-points) to get some inspiration for the kinds of content you can provide with checkout UI extensions.


To shape your extension you have the following collection of tools available:
* [UI components](https://shopify.dev/api/checkout-extensions/checkout/components), the visual elements you can render in your extension.
* [Extension APIs](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api), which give you access to read and write data in the checkout.

With these tools you'll get access to Shopify-enabled resources (such as [Analytics](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#analytics), [Localization](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#localization) or [Storage](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#storage)) and the frameworks that you need to read (and mutate) data for your Checkout-UI extension (like Shop, Customer, CartLine, MetaFields, etc.).
4
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
