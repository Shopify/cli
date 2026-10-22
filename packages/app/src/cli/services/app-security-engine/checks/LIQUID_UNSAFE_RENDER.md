---
id: LIQUID_UNSAFE_RENDER
version: 2
severity: medium
precedence: union
---

# Liquid Unsafe Render

Inspect only theme-extension Liquid/HTML files the parser could not analyze. Liquid output is not automatically HTML-escaped. Check the destination: use `escape`/`escape_once` for HTML text and ordinary attributes, `json` when embedding a value as JavaScript data, and `metafield_tag` only for supported rich metafield rendering in HTML content. HTML escaping is not sufficient for event handlers, `srcdoc`, or a `<script src>` URL; avoid merchant-controlled output there and validate any dynamic URL. An ordinary non-script `src` attribute is not itself an executable sink. `{% raw %}` suppresses Liquid parsing, so apparent output inside it is literal text. Follow rendered snippets and inspect ambiguous filters or parser failures before reporting.

As of version 2, the deterministic rule exempts exact `block.settings.<id>` output in app block files (`blocks/`) when the same file's `{% schema %}` defines the setting as `checkbox` or `range`, or as `select`/`radio` whose every option value is inert (no markup, quote, whitespace, `&`, or `=` characters). The output must be element text content or a quoted value of a statically named `class`, `id`, `title`, `alt`, `role`, `width`, `height`, `lang`, `dir`, or `aria-*` attribute. Filters are allowed only from a small inert set (`downcase`, `upcase`, `capitalize`, `strip`, `lstrip`, `rstrip`, `strip_newlines`, `handleize`, `handle`, `escape`, `escape_once`, without arguments) or `default` with an inert string, number, or literal fallback. `section.settings` in an app block refers to the host section and is not exempt, and a file that rebinds `block` (`assign`, `capture`, `for`, `tablerow`, `increment`, or `decrement`) loses the exemption entirely. Missing, unparseable, or duplicated schema, unsafe option values, other types, property access, other filters (including `url_decode`, `t`, and tag-producing filters such as `script_tag`), URL, style, `data-*`, or other attributes, Liquid that forms an attribute or tag name, unquoted attribute values, raw-text elements such as `<style>`, and JavaScript/executable contexts remain flagged as before.
