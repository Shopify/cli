---
id: UNSAFE_INNERHTML
version: 2
severity: high
---

Find cases where user-controlled data is written to the DOM without
sanitisation, creating a cross-site scripting (XSS) vulnerability.

Establish the controlling principal, victim, execution context, and affected
origin. An embedded app injection can act with the app's browser authority,
but does not inherit the Shopify Admin parent's origin or authority. Require
a concrete trust-boundary violation, not merely a raw-rendering API.

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
   - `script.textContent = ...` followed by inserting an executable script

2. **Find React/Vue dangerous rendering.** These frameworks auto-escape
   string interpolation, but have explicit escape hatches:
   - `dangerouslySetInnerHTML={{ __html: ... }}` — React
   - `v-html="..."` — Vue
   - Any prop or attribute named `html` that receives raw HTML

3. **Find Liquid executable contexts in theme extensions.** Shopify Liquid output is not automatically HTML-escaped, and `{% raw %}` suppresses Liquid parsing rather than escaping output. Trace dynamic output in `<script>`, event-handler, `srcdoc`, and `<script src>` contexts. `json` is appropriate when embedding a value as JavaScript data; HTML escaping alone does not make executable attributes safe. Do not treat ordinary non-script `src` attributes as executable sinks. Inspect parser failures, rendered snippets, computed filters, and URL validation when the deterministic result is ambiguous.

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

5. **Trace persisted fields to every renderer.** Do not stop at browser DOM
   sinks. Check whether the same lower-trust value later reaches generated
   JavaScript or service workers, email and PDF rendering, operator/admin UIs,
   previews, App Proxy active responses, or script/iframe URL construction.
   The key question is where the value becomes executable or privileged content.

6. **Verify defenses in the final parser context.** Follow the actual helper,
   configuration, and any decoding or mutations after sanitization:
   - `DOMPurify.sanitize(...)` or another library is not proof by name alone;
     verify which executable constructs survive in the destination context.
   - `escapeHTML(...)` can protect HTML text, but is not automatically safe in
     JavaScript, event-handler, or URL contexts.
   - `textContent` on an ordinary non-executable element does not parse HTML;
     trace any later consumer that reparses its text as HTML or code.
   - `script.textContent` can become executable when the script is inserted.
     Check its type, insertion path, enforced CSP, and sandboxing rather than
     treating every text-node write as safe.

## XSS evasion patterns to check for

When checking whether sanitisation is adequate, consider these evasion
techniques that bypass naive string-matching:

- **Event handler attributes**: `<img src=x onerror="...">` — a sanitizer
  that strips `<script>` tags but leaves `onerror` attributes is bypassable
- **Base64-encoded payloads**: `atob("...")` decoded at runtime — evades
  static string matching for known XSS strings
- **Data URI payloads**: `<iframe src="data:text/html,...">`
- **SVG payloads**: `<svg onload="...">` — some sanitizers miss SVG events

A custom sanitizer is not automatically vulnerable, and a well-known library
is not automatically safe in every context. Report a bypass only when you can
identify a concrete construct that survives the defense and executes in the
actual renderer, accounting for enforced CSP and sandboxing.

## What to report

Report paths where lower-trust data becomes executable content across a
demonstrated authority boundary. Explain the execution mechanism; a `<script>`
inserted through `innerHTML` does not execute like a parser-inserted script.

```json
{
  "file": "extensions/.../widget.js",
  "line": 42,
  "message": "Buyer-authored review rendered via innerHTML without sanitisation",
  "snippet": "el.innerHTML = review.body",
  "evidence": [
    {
      "file": "extensions/.../widget.js",
      "line": 42,
      "quote": "el.innerHTML = review.body"
    },
    {
      "file": "extensions/.../widget.js",
      "line": 30,
      "quote": "const review = await response.json()"
    }
  ],
  "confidence": "high",
  "reasoning": "The buyer-authored review reaches innerHTML without escaping or sanitisation. Event-handler markup can execute when another shopper views the review, with the storefront origin and that shopper's browser authority."
}
```

Do not report:

- Literal HTML strings (`el.innerHTML = "<b>Static</b>"`)
- `textContent` writes to non-executable elements with no later executable consumer
- React JSX with string interpolation (auto-escaped)
- `dangerouslySetInnerHTML` with static/constant content (still risky but
  if the content is a constant string, there's no XSS vector from user input)
- Inputs adequately escaped or sanitized for the final context, whether the
  defense is custom or library-provided
- `eval()` or `new Function()` with literal strings (no user input)

If missing producer, sanitizer, or execution-context evidence prevents a
conclusion, record the check as unresolved with the review pack's structured
reason and actionable guidance. Do not turn incomplete tracing into a finding
or a pass.
