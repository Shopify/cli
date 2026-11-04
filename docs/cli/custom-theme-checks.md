# Custom Theme Check execution

Theme Check runs its built-in checks by default. Custom checks execute JavaScript with your user permissions and require explicit authorization.

For a trusted theme and its custom checks, run:

```sh
shopify theme check --allow-custom-checks
shopify theme language-server --allow-custom-checks
```

The flag also applies to `theme check --print` and `theme check --list`, which load configuration and check metadata. Use `SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS=1` to opt in from a trusted automation environment. `--no-allow-custom-checks` overrides that environment variable for an invocation.

`shopify.theme.toml` cannot grant execution permission. The command reads authorization from its original arguments and process environment, independently of default or named theme environments. `.theme-check.yml` and inherited configs can declare custom checks but cannot authorize them.

Without permission, Theme Check skips custom checks while continuing to run built-in checks. Text output includes a notice in the final Theme Check Summary with the `--allow-custom-checks` flag to enable them. JSON output emits a diagnostic warning on stderr. The notice does not count as an offense and appears only when custom checks were skipped. Configuring `--config` explicitly does not grant execution permission. The permission applies to all custom checks discovered for the invocation, including their imported dependencies and later language-server reloads.

This change depends on the theme-tools release introducing `LoadConfigOptions.authorizeCustomChecks` and a default-deny custom check loader. Upgrade both `@shopify/theme-check-node` and `@shopify/theme-language-server-node` in `packages/theme/package.json` together when that release is published. Older versions do not enforce the permission callback.
