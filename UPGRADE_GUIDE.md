<!--
THIS FILE IS A LAST RESORT. DO NOT BREAK THINGS FOR USERS.

If users need to do any explicit steps to upgrade to a new version due to broken
backwards compatibility, this is the place to mention it.

Again, if this file has any content, something has gone wrong.

It should look like this:

# Apps

## 3.89

* Version 3.89 no longer supports TOML files. Instead, we have moved to the
battle-tested technology of XML. To upgrade automatically, navigate to the
root of your app and run `npm shopify migrate-app-toml-to-xml`.

But seriously, PLEASE DO NOT MAKE THIS FILE NECESSARY.
-->

# Themes

## Project trust for theme push and dev

`shopify theme push` and `shopify theme dev` now require the target store to be trusted in the nearest `shopify.theme.toml` file. Existing non-interactive scripts must complete this one-time migration by adding a named environment:

```toml
[environments.production]
store = "example.myshopify.com"
```

Then select that environment in the script:

```sh
shopify theme push --environment production
```

After this one-time project trust configuration, future runs remain non-interactive. Passing `--store` and valid credentials does not establish project trust.
