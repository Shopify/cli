---
id: CROSS_SITE_SCRIPTING
version: 1
severity: high
---

# Cross-Site Scripting

Find reflected, stored, and client-side paths where lower-trust data becomes
executable browser content across a trust boundary. Cover app-owned HTML pages,
server templates, embedded app views, customer-facing pages, and operator UIs,
not only theme extensions. Prove the source, rendering context, victim, and
reachable execution path; an HTML-looking string or raw-rendering API alone is
not a finding.

## What to look for

1. **Map producers and consumers.** Identify the actual web frameworks, template
   engines, versions, escaping defaults, and rendering helpers. Trace URL/query
   and form/JSON input, stored customer/merchant content, product/metafield data,
   imports, webhook fields, and third-party API responses to their renderers.
   For client-side flows, include location fragments, storage, DOM attributes,
   and `postMessage` data after examining sender/origin validation. A database
   read, authenticated route, or Shopify API response does not by itself make
   the contained user-authored data trusted.

2. **Inspect server-rendered escape hatches.** Follow response builders, layouts,
   partials, and component wrappers into final HTML, including:
   - Express/React Router HTML responses assembled with strings, and custom
     server-side rendering or hydration/bootstrap data.
   - Rails `raw`, `html_safe`, and HTML/inline rendering; EJS `<%- ... %>`,
     unescaped Handlebars output, Django/Jinja `safe` or disabled autoescaping,
     and Blade/Twig raw output.
   - Markdown/rich-text renderers with raw HTML or unsafe link handling.
   Read the real helper and framework behavior. A bypass API is only a lead;
   constant HTML and correctly escaped dynamic text are not findings.

3. **Follow browser-side rendering and execution.** Inspect DOM HTML writes,
   React `dangerouslySetInnerHTML`, Vue `v-html`, Svelte `{@html}`, Lit
   `unsafeHTML`, Angular trust-bypass APIs, and wrappers around these sinks.
   Also inspect dynamic script URLs, event handlers, `srcdoc`, and strings
   passed to browser `eval`, `Function`, or timers. Follow stored content from
   its original write to later preview, support, or admin views; do not stop
   at a safe first renderer. Coordinate these paths with the existing checks
   listed below instead of creating duplicate findings.

4. **Evaluate the exact output context.** Determine whether input lands in HTML
   text, a quoted/unquoted attribute, a URL, JavaScript data/code, CSS, or a nested
   context. HTML text escaping is not sufficient for an event handler or a
   script/URL context. URL encoding a parameter is not scheme validation for an
   entire `href` or `src`. For JSON embedded inside an HTML `<script>` element,
   including non-executable JSON data blocks, verify that serialization prevents
   an HTML `</script>` breakout; `JSON.stringify` alone does not do this. Do not
   invent the same breakout for JSON served as an inert `application/json`
   response. Trace any later consumer that reparses it as HTML or code.

5. **Verify defenses at the final sink.** Follow escaping, HTML sanitization,
   URL allowlists, framework autoescaping, Trusted Types policies, and any
   decoding or mutations after sanitization. Check actual configuration and
   context, not just a sanitizer's name. A custom sanitizer is not automatically
   vulnerable, and a library call is not automatically safe in every context.
   To report a bypass, explain the concrete construct that survives the defense
   and can execute in that renderer. Account for enforced CSP and sandboxing;
   do not assume a bypass. Missing CSP alone is not XSS, and HttpOnly cookies
   do not prevent script from acting with the victim's browser authority.

6. **Establish a victim and authority boundary.** Identify who can supply the
   input, how another principal encounters it, the document's actual origin,
   and the actions or data script could reach there. An embedded app iframe
   does not inherit the Shopify Admin parent's origin or authority. Content
   executing in an isolated or sandboxed origin must not be described as
   executing in the parent without evidence. Intentional author-controlled
   HTML, self-XSS requiring the victim to paste code, and a merchant editing
   their own permitted storefront code are not automatically privilege
   escalation. Show a lower-trust writer reaching a more privileged reader,
   another user/tenant, or a surface where executable content is not authorized.

## Coordinate with existing checks

Follow the complete path even when it crosses surfaces, but report the same
source-to-sink vulnerability only once, under the most specific owning check:

- `UNSAFE_INNERHTML`: DOM HTML writes and browser code-evaluation sinks.
- `THEME_EXTENSION_XSS` / `LIQUID_UNSAFE_RENDER`: theme-extension Liquid output.
- `TEXT_SETTING_HTML_SMUGGLING`: merchant text settings becoming active content.
- `APP_PROXY_LIQUID_INJECTION`: values from verified app-proxy requests reaching
  active responses.
- `SCRIPT_TAG_URL_INJECTION`: Shopify ScriptTag source URLs.
- `ACTIVE_UPLOADS_AND_PRIVILEGED_PREVIEWS`: uploaded/imported active files and
  their privileged previews.

Delegate only when the specialized check covers the complete source-to-sink
path, not merely the response surface, and use that check's own provenance.
Use `CROSS_SITE_SCRIPTING` for remaining paths, such as reflected server HTML,
stored customer content in an operator template, unsafe hydration data, or
active URL/attribute output outside those specialized paths. Stored buyer
reviews rendered in app-proxy HTML/Liquid responses remain here when the
content comes from a separate submission endpoint rather than the verified
proxy request. Do not suppress a distinct vulnerable sink just because the
same input is used elsewhere.

## What to report

Use the review pack's current finding and execution schemas, including this
check's ID, version, and prompt hash. Each finding must include:

- The controlling principal, entry point, victim interaction, and required access.
- File/line evidence for input or persistence, transformations, render call,
  and final sink/template, including any ineffective defense.
- The exact parser context and a minimal inert marker/example showing how data
  becomes executable content. Explain the execution mechanism; do not assume
  a `<script>` inserted via `innerHTML` executes like a parser-inserted script.
- The affected origin and concrete authority exposed, without assuming access
  to parent frames, HttpOnly cookies, or unrelated tenants.
- A context-appropriate fix: preserve autoescaping, render as text, serialize
  safely for HTML embedding, validate active URLs, or sanitize permitted HTML.

Do not probe live stores, exfiltrate data, or persist active payloads in real
merchant content. Code-level evidence can establish the path. Do not report
ordinary autoescaped interpolation, text-node writes in non-executable elements,
constant markup, or adequately sanitized content. HTML injection without an
executable path, server-side template execution, and unsafe redirects are not
by themselves proof of XSS. Email/PDF output is not browser script execution
without evidence of an affected active renderer.

Record the inspected files and review boundary. If a missing producer, renderer,
sanitizer implementation, or execution context prevents a conclusion, record
an unresolved check with the review pack's structured reason and actionable
guidance. Do not turn incomplete tracing into either a finding or a pass.
