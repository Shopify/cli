# Checkout UI Extension

Checkout UI extensions let app developers build custom functionality that users can install at defined points in the checkout flow. You can learn more about checkout UI extensions in Shopify’s [developer documentation](https://shopify.dev/api/checkout-extensions/checkout).


## Prerequisites
Make sure to complete [all the prerequisites](https://shopify.dev/apps/checkout/delivery-instructions/getting-started#requirements) from any tutorials to develop a Checkout UI extension.

## Tutorials
The best way to get started is to follow some of the available Extension Tutorials:

For creating an extension:
* [Enable extended delivery instructions](https://shopify.dev/apps/checkout/delivery-instructions)
* [Adding product offer recommendations](https://shopify.dev/apps/checkout/product-offers)
* [Creating a custom banner](https://shopify.dev/apps/checkout/custom-banners)

To add specific features to an extension
* [Adding field validation](https://shopify.dev/apps/checkout/validation)
* [Localizing an extension](https://shopify.dev/apps/checkout/localize-ui-extensions)

## Getting Started
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

> By default, your extension is configured to target the `Checkout::Dynamic::Render` [extension point](https://shopify.dev/api/checkout-extensions/checkout#extension-points). This extension point does not have a single location in the checkout where it will appear; instead, a user installing your extension will configure where *they* want your extension to show up.
> If you are building an extension that is tied to existing UI element in the checkout, such as the cart lines or shipping method, you can change the extension point so that your UI extension will render in the correct location. Check out the list of [all available extension points](https://shopify.dev/api/checkout-extensions/checkout#extension-points) to get some inspiration for the kinds of content you can provide with checkout UI extensions.


To shape your extension you have the following collection of tools available:
* [UI components](https://shopify.dev/api/checkout-extensions/checkout/components), the visual elements you can render in your extension.
* [Extension APIs](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api), which give you access to read and write data in the checkout.

> If you are using React, there is also a large collection of [React Hooks available](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#react-hooks) to ease access to these operations, otherwise you'll need to manually subscribe to the subscribable value directly with a callback.

## FAQ
* **How can I preview my extension?**

  1. Make sure you've started your local development server using `npm|yarn|pnpm dev`
  2. Depending on your selected location they may be either `dynamic` or `static` extension points, which differ slightly on the process to preview them.
      - `Dynamic extensions` can be placed using a [query string parameter](https://shopify.dev/apps/checkout/test-ui-extensions#dynamic-extension-points).
      - `Static extensions` require no extra work, just note that a static extension is shown only if the section that they are attached to is enabled.

* **How can I change my extension type?**

    To change your extension type, be mindful that you have to change it in the following places:
    1. In your `script file`, where you declared the extension (will be either _render()_ or _extend()_), you'll have to change the declared Extension Point.
    2. In your `settings TOML file` (shopify.ui.extension.toml) you'll have to change the `extension_points` declaration for your new desired type.

* **How do I let users customize my extension?**

    You can let users customize your extension through the [checkout ui extension settings](https://shopify.dev/api/checkout-extensions/checkout/configuration#settings-definition) which define a set of fields and values that the user can set from the checkout editor. You can use validation options to apply additional constraints to the data that the setting can store, such as a minimum or maximum value.

    To learn more, you can follow the step-by-step process in the tutorial to [add a custom banner](https://shopify.dev/apps/checkout/custom-banners/add-custom-banner).

## Useful Links

- [Checkout app documentation](https://shopify.dev/apps/checkout)

- [Checkout UI extension documentation](https://shopify.dev/api/checkout-extensions)
  - [Configuration](https://shopify.dev/api/checkout-extensions/checkout/configuration)
  - [API Reference](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api)
  - [UI Components](https://shopify.dev/api/checkout-extensions/checkout/components)
  - [Available React Hooks](https://shopify.dev/api/checkout-extensions/checkout/extension-points/api#react-hooks)
