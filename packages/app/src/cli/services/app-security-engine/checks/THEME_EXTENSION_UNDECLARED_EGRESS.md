---
id: THEME_EXTENSION_UNDECLARED_EGRESS
version: 1
severity: medium
precedence: union
---

# Theme Extension Undeclared Egress

Theme app extensions declare the origins their storefront code contacts in `shopify.extension.toml`, under `[capabilities.network_access] allowed_sources` (`[extensions.capabilities.network_access]` in the `[[extensions]]` format). Entries are HTTPS origins such as `https://api.example.com`, with an optional port. A leading `*.` covers one or more subdomain labels but not the bare domain. Requests to undeclared origins may be reported now and blocked on storefronts later.

Inspect only theme app extensions (`type = "theme"`). The deterministic rule already reports literal URLs in Liquid and HTML (`<script src>`, fetching `<link href>`, `<iframe src>`, `<img src>`, `<source src>`, the `script_tag` and `stylesheet_tag` filters, inline `<script>` and `<style>`), in JavaScript assets (`fetch`, `XMLHttpRequest#open`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, dynamic `import()`, `new URL`), and in CSS assets (`url()`, `@import`). Focus on what it can't resolve:

- URLs built at runtime (template literals, concatenation, variables, Liquid output) whose origin is nonetheless fixed by the code, such as a constant base URL defined elsewhere in the extension.
- Liquid files the parser couldn't read.
- Sinks it doesn't scan, such as `srcset`, `<video>`/`<audio>` `src`, `style` attributes, `Worker` and `importScripts`, and requests made by third-party libraries bundled in the extension's assets.

Report a finding only when the code establishes a concrete external origin that the extension's `allowed_sources` doesn't cover, or any `http:`/`ws:` origin, which can't be declared. Cite the line that makes the request. If the extension doesn't declare `allowed_sources`, report one finding on its `shopify.extension.toml` that lists the origins. Relative URLs, URLs from Liquid filters such as `asset_url`, the shop's own routes, and Shopify-owned hosts (`cdn.shopify.com`, `shopify.com`, `*.myshopify.com`) are not findings. A URL that a merchant configures in a block setting is not a finding, because its origin isn't known until runtime. Navigation (`<a href>`, `<form action>`, `location` changes, `window.open`) is out of scope.
