---
id: UNSAFE_INNERHTML
version: 3
tier: agentic
severity: critical
---

Find cases where user-controlled data is written to the DOM without
sanitisation, creating a cross-site scripting (XSS) vulnerability.

XSS in a Shopify app is particularly dangerous because the app runs
inside the admin iframe. A script injection can access the merchant's
session, make API calls on their behalf, or exfiltrate data.

## What to look for

1. **Find all DOM write calls.** Search for every pattern that parses
   HTML, not just innerHTML:
   - `element.innerHTML = ...`
   - `element.outerHTML = ...`
   - `element.insertAdjacentHTML(position, ...)`
   - `document.write(...)`
   - `document.writeln(...)`
   - `eval(...)` — code injection, not HTML, but same attacker entry point
   - `setTimeout(string, ...)` / `setInterval(string, ...)` — evals string
   - `new Function(string)` — evals string

2. **Find React/Vue dangerous rendering.** These frameworks auto-escape
   string interpolation, but have explicit escape hatches:
   - `dangerouslySetInnerHTML={{ __html: ... }}` — React
   - `v-html="..."` — Vue
   - Any prop or attribute named `html` that receives raw HTML

3. **Find Liquid unsafe rendering.** In theme app extensions:
   - `{{ variable }}` — safe (auto-escaped)
   - `{{ variable | raw }}` — unsafe (bypasses escaping)
   - `{{ variable | escape_once }}` — partially safe

4. **Trace the data source.** For each write, determine what's being
   inserted. User-controlled sources include:
   - URL parameters: `searchParams`, `URLSearchParams`, `params`
   - Form input: `formData`, `request.json()`
   - **Metafield values**: `product.metafield.value`,
     `metafield.namespace.key`, `metafieldsSet` responses
     — these are merchant-writable, so they are user-controlled even
     though they look like app config
   - GraphQL responses: product titles, customer names, review text
   - API responses that include merchant-editable fields
   - A literal string — not a finding
   - A config constant — not user-controlled, not a finding

5. **Check for sanitisation.** Is the data passed through:
   - `DOMPurify.sanitize(...)` — but verify it handles event handler
     attributes (onerror, onload, onfocus, onclick), not just tag removal
   - `escapeHTML(...)` or a similar escaping function
   - A textContent assignment instead (safe — textContent doesn't parse HTML)

## XSS evasion patterns to check for

When checking whether sanitisation is adequate, consider these evasion
techniques that bypass naive string-matching:

- **Event handler attributes**: `<img src=x onerror="...">` — a sanitizer
  that strips `<script>` tags but leaves `onerror` attributes is bypassable
- **Base64-encoded payloads**: `atob("...")` decoded at runtime — evades
  static string matching for known XSS strings
- **Data URI payloads**: `<iframe src="data:text/html,...">`
- **SVG payloads**: `<svg onload="...">` — some sanitizers miss SVG events

If the sanitizer is a custom function (not DOMPurify or a well-known
library), flag it — custom sanitizers are frequently bypassable.

## What to report

For each DOM write where user-controlled data (including metafield values)
reaches the DOM unsanitised:

```json
{
  "file": "extensions/.../widget.js",
  "line": 42,
  "message": "User-controlled metafield value rendered via innerHTML without sanitisation",
  "snippet": "el.innerHTML = product.metafield.custom.value",
  "evidence": [
    {
      "file": "extensions/.../widget.js",
      "line": 42,
      "quote": "el.innerHTML = product.metafield.custom.value"
    },
    {
      "file": "extensions/.../widget.js",
      "line": 30,
      "quote": "const metafield = await admin.rest.get({ path: 'metafields' })"
    }
  ],
  "confidence": "high",
  "reasoning": "The metafield value is merchant-writable (user-controlled) and is inserted into innerHTML without DOMPurify or equivalent sanitisation. An attacker who controls the metafield value can inject script tags that execute in the storefront."
}
```

Do not report:

- Literal HTML strings (`el.innerHTML = "<b>Static</b>"`)
- `textContent` assignments (safe — no HTML parsing)
- React JSX with string interpolation (auto-escaped)
- `dangerouslySetInnerHTML` with static/constant content (still risky but
  if the content is a constant string, there's no XSS vector from user input)
- Sanitised inputs (`DOMPurify.sanitize(userInput)`) — unless the sanitizer
  is custom and might miss event handler attributes
- `eval()` or `new Function()` with literal strings (no user input)
