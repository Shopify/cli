---
id: THEME_EXTENSION_XSS
version: 1
tier: agentic
severity: critical
---

Find cases where theme app extensions render user-controlled data
without escaping, creating XSS vulnerabilities in the merchant's
storefront.

Theme app extensions render Liquid in the merchant's storefront. If
the Liquid renders user-controlled data (metafields, product data,
customer input, URL parameters) without proper escaping, an attacker
can inject script that executes on the merchant's store — affecting
every visitor to that store.

This is distinct from `UNSAFE_INNERHTML` (which targets JavaScript
DOM writes). Theme extension XSS happens in Liquid, server-side,
through Shopify's rendering pipeline. The entry point is a Liquid
template, not a JavaScript file.

## What to look for

1. **Find all Liquid files in theme app extensions.** Search for:
   - `*.liquid` files under `extensions/` or `theme-app-extension/`
   - Liquid blocks, snippets, sections
   - Theme extension entry points

2. **Find `| raw` filter usage.** The `raw` filter bypasses Liquid's
   auto-escaping:
   - `{{ variable | raw }}` — renders unescaped HTML
   - `{{ variable | raw }}` where variable is user-controlled — XSS
   - Check whether the variable is proven trusted HTML (e.g. a constant
     or app-generated content) or user-controlled

3. **Trace Liquid data sources.** For each `{{ }}` output, determine
   where the data comes from:
   - `{{ product.metafield.custom.field }}` — merchant-writable, user-controlled
   - `{{ customer.metafield.app.value }}` — customer-editable in some apps
   - `{{ variant.metafield.custom.html }}` — could contain malicious HTML
   - `{{ request.params.x }}` — URL parameter, user-controlled
   - `{{ shop.metafield.app.config }}` — merchant-configurable
   - `{{ block.settings.text }}` — theme settings, merchant-configurable
   - `{{ app.metafield.namespace.key }}` — app metafield, could be
     merchant-writable depending on permissions

4. **Check Liquid rendering context.** Liquid auto-escapes `{{ }}`
   output, but there are exceptions:
   - `| raw` — bypasses escaping entirely
   - `{% liquid %}` blocks with `echo` — auto-escaped
   - `{% render %}` with `{{ }}` inside the rendered snippet — escaped,
     but check the snippet's own output
   - JSON responses with `{{ }}` — escaped for JSON, not for HTML context

5. **Find JavaScript in theme extensions.** Theme extension assets
   (`.js` files) that:
   - Read from the DOM (URL params, metafield values rendered in hidden
     elements) and write to innerHTML — overlaps with `UNSAFE_INNERHTML`
   - Use `postMessage` with unvalidated origin — can receive XSS payloads
     from other windows
   - Read `window.Shopify` data that includes merchant-editable fields

## What to report

For each Liquid template or JS file that renders user-controlled data
without escaping:

```json
{
  "file": "extensions/theme-app-extension/blocks/widget.liquid",
  "line": 15,
  "message": "Metafield value rendered with | raw filter — XSS in storefront",
  "snippet": "{{ product.metafield.custom.html | raw }}",
  "evidence": [
    {
      "file": "extensions/.../blocks/widget.liquid",
      "line": 15,
      "quote": "{{ product.metafield.custom.html | raw }}"
    }
  ],
  "confidence": "high",
  "reasoning": "The metafield value is merchant-writable (user-controlled) and rendered with the raw filter, bypassing Liquid's auto-escaping. An attacker who controls the metafield can inject script that executes on the merchant's storefront."
}
```

Do not report:

- `{{ variable }}` without `| raw` (auto-escaped by Liquid)
- `{{ variable | raw }}` where the variable is a constant or app-generated
  trusted HTML
- `{{ variable | escape }}` or `{{ variable | escape_once }}` (escaped)
- JavaScript `textContent` assignments (safe)
- Test files
