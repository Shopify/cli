---
id: SHARED_NAMESPACE_METAFIELD_RENDER
version: 1
severity: medium
---

# Shared Namespace Metafield Render

Find metafield and metaobject values the app renders from a shared namespace. Merchant-owned metafields and metaobjects are writable by the merchant and by every other app installed on the shop with write access to that resource. If another app is compromised, an attacker can overwrite a value this app renders, so a shared-namespace value is lower-trust input even when this app is its only intended writer.

Trace every metafield or metaobject value the app reads to where it is output: Liquid in theme app extensions, Storefront API responses written to the DOM, Admin API responses rendered in the embedded app, and App Proxy responses.

## Classify the namespace

Decide ownership from the namespace or type prefix in the code. Don't look up definitions in `shopify.app.toml`.

- App-owned: `$app`, `$app:<sub-namespace>`, a literal `app--…` namespace, or `app.metafields`. In Liquid, for example `product.metafields["$app:custom"]`, `app.metafields.…` and `<resource>.metafields['app--…']`. For metaobjects, a `$app:` type.
- Shared: every other literal namespace or type, such as `custom`, `reviews` or `specs`. Treat `shopify--` namespaces and standard definitions as shared too: Shopify controls their structure, but merchants and apps can write their values.
- Unresolved: a namespace built at runtime, such as `product.metafields[ns]` or a `namespace` variable passed to a query. Name the candidate; don't guess its ownership.

Treat any `app--` prefix as app-owned, even though it could belong to a different app.

## Report when

A shared-namespace value reaches HTML, JavaScript or URL output and either:

- isn't escaped or serialized for that context, for example raw Liquid output, `innerHTML`, `dangerouslySetInnerHTML`, or an `href`, `src` or script URL built without scheme validation; or
- is deliberately rendered as raw HTML, script or a URL, even when this app writes the value itself, for example widget markup or tracking code stored in `reviews.widget_html`.

Report this check alongside any XSS check that also reports the same sink. This check is about who else can write the value, not a replacement for the escaping those checks require.

## Don't report

- App-owned values. Being app-owned doesn't make a value safe: the merchant can still edit it when the definition allows, and the XSS checks still require escaping.
- Shared values that are escaped for their exact context, rendered as text, serialized with `json`, or rendered with `metafield_tag`.
- Shared values passed through a strict allowlist sanitizer that is adequate for the final output context, whether the defense is custom or library-provided. A sanitizer's name alone isn't proof: verify its configuration and which executable constructs survive in that context.
- Values used only as data that never reaches HTML, JavaScript or URL output.

## Suggested fix

- Move the field to an app-owned namespace with a declared definition, `[<resource>.metafields.app.<key>]` in `shopify.app.toml`. Use `access.admin = "merchant_read"` if merchants shouldn't edit it, and `access.storefront = "public_read"` if the Storefront API needs it.
- Prefer typed fields over HTML strings, for example `rich_text_field` rendered with `metafield_tag`, or a `url` field with a validated scheme.
- Otherwise escape or `json`-serialize the value for its context. Never store executable code in a metafield.

If the app renders no metafield or metaobject values, record the check as `not_applicable`. If every value you traced is app-owned or safely output, record it as `executed`. Record it as `unresolved` only for a named dynamic namespace or a value whose output you couldn't trace.
