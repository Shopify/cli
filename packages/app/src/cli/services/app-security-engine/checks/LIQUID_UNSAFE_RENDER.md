---
id: LIQUID_UNSAFE_RENDER
version: 1
severity: medium
---

# Liquid Unsafe Render

Inspect only theme-extension Liquid/HTML files the parser could not analyze. Liquid output is not automatically HTML-escaped. Check the destination: use `escape`/`escape_once` for HTML text and ordinary attributes, `json` when embedding a value as JavaScript data, and `metafield_tag` only for supported rich metafield rendering in HTML content. HTML escaping is not sufficient for event handlers, `srcdoc`, or a `<script src>` URL; avoid merchant-controlled output there and validate any dynamic URL. An ordinary non-script `src` attribute is not itself an executable sink. `{% raw %}` suppresses Liquid parsing, so apparent output inside it is literal text. Follow rendered snippets and inspect ambiguous filters or parser failures before reporting.
