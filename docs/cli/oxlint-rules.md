# Oxlint Rules

To ensure contributions follow the project's conventions, the project uses
[Oxlint](https://oxc.rs/docs/guide/usage/linter.html) with native and local rules.
This page lists the local rules and the conventions they enforce.

### `command-flags-with-env`

This rule ensures that command flags have the environment variable set.
This way users can decide between passing flags using arguments or environment variables:

```bash
shopify app generate extension --type product_subscription

# vs

SHOPIFY_FLAG_EXTENSION_TYPE=product_subscription shopify app generate extension
```

### `command-conventional-flag-env`

This rule ensures that the environment variable that we associate to commands' flags follows a convention.

```ts
export default class Dev extends Command {
  static flags = {
    path: Flags.string({
      hidden: true,
      env: 'SHOPIFY_FLAG_PATH', // Correct
    }),
    force: Flags.string({
      hidden: true,
      env: 'FORCE', // Error
    }),
  }
}
```

### `command-reserved-flags`

This rule ensures that reserved flags use the same environment variable.

```ts
export default class Dev extends Command {
  static flags = {
    path: Flags.string({
      hidden: true,
      env: 'SHOPIFY_FLAG_APP_PATH', // Incorrect: It must be SHOPIFY_FLAG_PATH
    }),
  }
}
```
