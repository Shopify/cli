---
'@shopify/app': minor
---

Add support for configurable app URL path in shopify.web.toml. Developers can now specify a custom app entry point using the `app_url_path` parameter, enabling flexible URL organization for complex APIs where the Shopify app functionality is nested under a specific path.

Example usage:
```toml
# shopify.web.toml
roles = ["backend"]
app_url_path = "/api/shopify"
auth_callback_path = ["/api/shopify/install/callback", "/api/shopify/auth/callback"]
```