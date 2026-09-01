---
id: THEME_EXTENSION_XSS
version: 1
tier: agentic
severity: high
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

2. **Inspect every dynamic output context.** Shopify Liquid output is not automatically HTML-escaped, and `{% raw %}` suppresses Liquid parsing so apparent output inside it is literal text. Determine whether each value uses context-appropriate handling such as `escape`/`escape_once` in HTML text or ordinary attributes, `json` when embedding JavaScript data, or `metafield_tag` for supported rich metafield rendering. HTML escaping is not sufficient for event handlers, `srcdoc`, or `<script src>` URLs.

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

4. **Check Liquid rendering context.** `{{ }}` and `echo` emit the rendered value; safety depends on its type, filters, and destination context. Follow rendered snippets and require HTML escaping, URL validation, or JSON serialization as appropriate.

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
  "message": "Metafield value rendered into an executable attribute without context-appropriate escaping",
  "snippet": "<div onclick=\"{{ product.metafields.custom.code }}\">",
  "evidence": [
    {
      "file": "extensions/.../blocks/widget.liquid",
      "line": 15,
      "quote": "<div onclick=\"{{ product.metafields.custom.code }}\">"
    }
  ],
  "confidence": "high",
  "reasoning": "The metafield value is merchant-writable and emitted into an executable attribute without context-appropriate handling. An attacker who controls the metafield can inject script that executes on the merchant's storefront."
}
```

Do not report:

- Output whose value and destination are both proven safe
- Apparent Liquid output inside `{% raw %}...{% endraw %}`, because the raw tag suppresses Liquid parsing and leaves those delimiters as literal text
- `{{ variable | escape }}` or `{{ variable | escape_once }}` (escaped)
- JavaScript `textContent` assignments (safe)
- Test files
