---
id: TEXT_SETTING_HTML_SMUGGLING
version: 1
tier: agentic
severity: high
---

Find cases where merchant-configurable text settings are rendered as HTML
without sanitisation, allowing HTML to be smuggled past custom-JS detection.

Many apps have settings fields where merchants can enter custom text —
header text, banner content, widget titles, custom CSS, "additional
HTML" fields. If the app renders these settings as raw HTML server-side
or in Liquid, the merchant can inject arbitrary HTML including script
tags, iframes, or event handlers.

This is distinct from `UNSAFE_INNERHTML` (which targets JavaScript
DOM writes). HTML smuggling via text settings bypasses custom-JS detection
because the HTML is rendered server-side or in Liquid, not via
`innerHTML` in JavaScript. A scanner looking for `innerHTML` will miss it.

## What to look for

1. **Find text/settings fields that accept arbitrary input.** Search for:
   - Rails: settings models, `ShopSetting`, `AppConfig`, preference columns
     that store text/HTML
   - Remix: settings mutations that store text in metafields or app data
   - Liquid: theme settings schema with text fields (`"type": "text"`,
     `"type": "richtext"`)
   - Any field named `header_html`, `custom_html`, `banner_text`,
     `additional_script`, `tracking_code`

2. **Trace where the setting value is rendered.** For each setting:
   - Rails: `render html: setting.value`, `render(inline: setting.value)`,
     `<%= raw setting.value %>`, `setting.value.html_safe`
   - Liquid: `{{ setting.value | raw }}`, `{{ setting.value }}` in a
     context where the content type is `text/html` (not `text/plain`)
   - JavaScript: if the setting value flows into `innerHTML` — this
     overlaps with `UNSAFE_INNERHTML` but the entry point is a settings
     field, not a URL param
   - React: `dangerouslySetInnerHTML` where the HTML comes from a
     settings/metafield value

3. **Check whether the setting is merchant-configurable.** The key
   question is: can the merchant (or an attacker who compromised the
   merchant account) control this value?
   - If the value is set by the app developer in code — not user-controlled
   - If the value is set by the merchant through a settings UI — user-controlled
   - If the value is stored in a metafield that the merchant can edit — user-controlled
   - If the value comes from a product/customer metafield — user-controlled

4. **Check for sanitisation.** Is the setting value sanitised before
   rendering?
   - `sanitize_html(setting.value)` or equivalent
   - Content type set to `text/plain` instead of `text/html`
   - Liquid auto-escape (no `| raw` filter)
   - Allowlist of permitted HTML tags

5. **Look for richtext settings.** Theme extension settings with
   `"type": "richtext"` are designed to accept HTML — but if the app
   renders them without sanitisation in a context where script execution
   is possible, it's still a vulnerability.

## What to report

For each setting rendered as HTML without sanitisation:

```json
{
  "file": "app/controllers/settings_controller.rb",
  "line": 20,
  "message": "Merchant-configurable header_text setting rendered as raw HTML",
  "snippet": "render html: shop_setting.header_text",
  "evidence": [
    {
      "file": "app/controllers/settings_controller.rb",
      "line": 20,
      "quote": "render html: shop_setting.header_text"
    },
    {
      "file": "app/models/shop_setting.rb",
      "line": 5,
      "quote": "field :header_text, :text (merchant-configurable)"
    }
  ],
  "confidence": "high",
  "reasoning": "The header_text setting is merchant-configurable and rendered as raw HTML without sanitisation. A merchant (or attacker who compromised the merchant account) can inject arbitrary HTML including script tags."
}
```

Do not report:

- Settings rendered as `text/plain` (no HTML parsing)
- Settings that are developer-configured constants (not merchant-editable)
- Settings with explicit HTML sanitisation (`sanitize_html`, allowlist)
- Liquid `{{ setting }}` without `| raw` (auto-escaped)
- Test files
