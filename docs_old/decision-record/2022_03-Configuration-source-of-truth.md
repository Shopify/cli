# March 2022 - Configuration source of truth

Before the rewrite of the CLI in NodeJS and when app development was not unified,
app and extension configuration was scattered across several files.
Some configuration lived in `.env` files, other in inconsistently-named YAML files like `extension.config.yml` and `.shopify-cli.yml`.
Besides the friction inconsistency adds to the developer experience,
the persistence of metadata that's only necessary for development (e.g. API secret and store domain) led to a lot of confusion.
For example,
users thought `shopify switch` to change the store would affect the app or the extension they wanted to serve.

With the Shopify CLI 3.0 **we revisited the approach to make it frictionless and less prone to confusion.**

Since the development of extensions is unified under apps,
**the configuration is inherited and extended from the app they belong to.**
An excellent example of a configuration that's inherited is the store domain.
When doing `shopify app dev` on a Shopify app, **the extension will be mounted on the store the app is connected to on the platform**.

Moreover, **we derive the information if it can be derived**.
For example, the API secret necessary to send authenticated requests to the Shopify Admin API is fetched using the Shopify CLI session and the store in which the app is installed.
There's no need to persist that locally in a `.env` file because we'd unnecessarily introduce the need for keeping that state in sync with the secret on the server.
Another example of this is the store domain. `shopify app dev` will support passing the store domain `shopify app dev --store mystore`.
When not passed, the CLI will prompt users to select a store, and remember the response to skip the selection in the next run.

The only information that will be **persisted in configuration files is the information tied to the app or the extension within the context of the platform**.
For example, identifiers. Those are necessary by the platform to uniquely identify the app and extensions when uploading them. Another example is scopes, which the platform uses to give specific permissions to apps. The configuration stored in configuration files is more permanent than an API secret and store domain, which are more ephemeral and tied to the Shopify app dev cycles.
