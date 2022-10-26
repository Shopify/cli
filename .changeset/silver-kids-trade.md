---
'@shopify/app': major
---

Adding support for a new auth_callback_path setting in web.shopify.toml, which overrides the values in the app setup when running the dev command.

This enables apps to use custom paths for their OAuth callback, but still have the CLI set the appropriate value in the Partners Dashboard to keep the development flow unchanged.

If you use a non-standard OAuth callback path, you can set this value to have the CLI automatically set the correct value for you.
