---
id: SCRIPT_TAG_URL_INJECTION
version: 1
tier: agentic
severity: critical
---

Find cases where the ScriptTag API is used with a URL derived from user
input, allowing an attacker to inject arbitrary scripts into every
merchant's storefront.

The ScriptTag API injects a `<script>` tag into the merchant's
storefront. If the `src` URL comes from user input (settings, params,
metafields), an attacker can point the script at any URL — a
compromised server, a malicious CDN, or a data URI with inline script.

Using ScriptTags at all is deprecated (theme app extensions should be
used instead). But using them with user-controlled URLs is an active
injection vector, not just a deprecation issue.

## What to look for

1. **Find all ScriptTag API calls.** Search for:
   - GraphQL: `scriptTagCreate`, `scriptTagUpdate`, `scriptTagsCreate`
   - REST: `ScriptTag.create`, `POST /admin/api/.../script_tags.json`
   - Ruby: `ShopifyAPI::ScriptTag.new`, `script_tag.create!`
   - Any code that creates or updates a script tag

2. **Trace the `src` URL.** For each ScriptTag call, determine where
   the `src` argument comes from:
   - `params[:url]`, `formData.get("url")`, `request.json().url` —
     user-controlled, injection vector
   - A settings field that the merchant can edit — user-controlled
   - A metafield value — merchant-writable, user-controlled
   - A hardcoded URL (`"https://cdn.myapp.com/widget.js"`) — not
     user-controlled, but still deprecated
   - A variable — trace it back to its assignment

3. **Check for URL validation.** Even if the URL comes from user input,
   it may be safe if:
   - The URL is validated against an allowlist of domains
   - The URL scheme is restricted to https
   - The URL is a relative path on the app's own domain

4. **Check for event handler payloads.** ScriptTags can also include
   `event` and `cache` parameters. If these come from user input, they
   can be used to control when the script loads and how it's cached.

## What to report

For each ScriptTag with a user-controlled `src` URL:

```json
{
  "file": "app/services/script_tag_manager.rb",
  "line": 15,
  "message": "ScriptTag created with src URL from merchant-configurable setting — injection vector",
  "snippet": "ScriptTag.create(src: shop_setting.script_url)",
  "evidence": [
    {
      "file": "app/services/script_tag_manager.rb",
      "line": 15,
      "quote": "ScriptTag.create(src: shop_setting.script_url)"
    },
    {
      "file": "app/models/shop_setting.rb",
      "line": 8,
      "quote": "field :script_url, :string (merchant-configurable)"
    }
  ],
  "confidence": "high",
  "reasoning": "The ScriptTag src URL comes from a merchant-configurable setting with no allowlist or domain validation. An attacker who controls the setting can inject a script from any URL into every installed merchant's storefront."
}
```

Do not report:

- ScriptTags with hardcoded URLs (deprecated but not an injection vector)
- ScriptTags where the URL is validated against an allowlist
- ScriptTags in test files
- Code that only reads existing ScriptTags (no create/update)
