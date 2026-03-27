---
name: shopify-checkout-ui
description: "Constraints, gotchas, and mental model for building Shopify Checkout UI Extensions"
metadata:
  author: shopify
  version: "1.0"
---

# Shopify Checkout UI Extensions

## Mental Model

Checkout is the highest-stakes surface in commerce. Bugs here lose revenue. Extensions run in a **sandboxed Web Worker** -- there is no DOM, no `window`, no `document`, no `<script>` tags, no arbitrary HTML. Only Shopify-provided components render. The platform controls layout, accessibility, and branding. You write logic and declare UI; Shopify renders it natively.

## Components Are Web Components (`<s-*>`), Not React DOM

- All UI uses custom HTML elements: `<s-text>`, `<s-button>`, `<s-stack>`, `<s-grid>`, `<s-box>`, etc.
- These are **not** React components. They follow standard web component property/attribute patterns.
- Preact is the default framework. Use Preact hooks (`useState`, `useEffect`) and JSX with `<s-*>` elements.
- In JSX, props that match an element property are set as properties; otherwise as attributes.
- Event handlers use camelCase in JSX (`onClick`, `onInput`, `onChange`). Under the hood they become `addEventListener` calls.
- Form inputs return **string** values, even for numeric fields. Multi-selects use a `values` prop (string array).
- `<s-clickable>` is an escape hatch; prefer `<s-button>` and `<s-link>` first.

## Data Access: Preact Signals, Not Hooks

- The global `shopify` object exposes all checkout APIs.
- APIs with a `value` property are **Preact Signals** (e.g., `shopify.shippingAddress.value`). Preact auto-re-renders when signals change.
- Do NOT use React-style hooks for checkout data. Read from `shopify.*` signals directly.

## Static vs Block Targets

| Type | Behavior | Use When |
|------|----------|----------|
| **Static** | Tied to a core checkout feature (e.g., before/after shipping methods). Disappears when that feature is hidden. | Content is tightly coupled to a checkout step. |
| **Block** | Merchant-positionable in the checkout editor. Always renders regardless of which features are active. | Content is independent (e.g., order notes, banners, loyalty points). |

- Register targets in `shopify.extension.toml` via `[[extensions.targeting]]`.
- Block targets support multiple placements with placement references (`INFORMATION1`, `DELIVERY1`, `PAYMENT1`, etc.).
- One extension can support multiple targets, but each target needs its own `module` file with a `default export`.

## 64 KB Compressed Bundle Limit

- Hard limit enforced at **deploy time** -- `shopify app deploy` will fail if exceeded.
- This means: no large libraries, no bundled CSS frameworks, no heavy GraphQL clients with DOM dependencies.
- Analyze with `shopify app build` and check output size. Keep dependencies minimal.

## Network Constraints

- **No arbitrary `fetch`** by default. Extensions run in a Web Worker with restricted network access.
- **Storefront API**: Enable `api_access` capability in TOML. Use the `query()` helper or the global `fetch` (auto-authenticated). Available scopes are unauthenticated read-only (products, collections, metaobjects, selling plans).
- **External network calls**: Require `network_access` capability AND Partner Dashboard approval. Your server **must** respond with `Access-Control-Allow-Origin: *` (CORS for any origin). The worker origin may change without notice.
- **Prefer metafields over network calls**: Use Admin API to write metafields ahead of checkout, then read them via `appMetafields` in the extension. Faster, no external call needed.
- Session tokens prove claim integrity but do NOT prove the request came from Shopify. Never expose sensitive endpoints that trust only a session token.

## No CSS Overrides

- Components inherit the merchant's brand settings automatically.
- You **cannot** override or inject CSS. There is no style API.
- Layout control is through component props only: `<s-stack>`, `<s-grid>`, `<s-box>` with `gap`, `padding`, `direction` props.
- Scale uses middle-out naming: `small-300 < small-100 < base < large-100 < large-300`.
- Responsive values use container query syntax: `@container (inline-size > 500px) large, small`.

## Other Critical Gotchas

- **Shopify Plus only**: Extensions in the information, shipping, and payment steps require Shopify Plus.
- **`block_progress` capability**: Must be declared in TOML for validation that blocks checkout. Merchants can disable it -- check `extension.capabilities` at runtime and show a warning fallback.
- **Settings**: Up to 20 fields per extension, configured in TOML. All settings are optional from the merchant's perspective -- code defensively.
- **Metafields**: Declare needed metafields in TOML. Use `$app` prefix for app-owned metafields. Only specific resources supported: cart, customer, product, variant, shop, company, companyLocation, shopUser.
- **No DOM APIs**: GraphQL clients like Apollo that use DOM APIs will not work. Use lightweight alternatives or the built-in `query()` helper.

## Documentation Pointers

| Topic | URL |
|-------|-----|
| Overview & getting started | https://shopify.dev/docs/api/checkout-ui-extensions |
| Extension targets reference | https://shopify.dev/docs/api/checkout-ui-extensions/extension-targets-overview |
| Web components (UI library) | https://shopify.dev/docs/api/checkout-ui-extensions/using-polaris-components |
| Configuration (TOML) | https://shopify.dev/docs/api/checkout-ui-extensions/configuration |
| Checkout APIs | https://shopify.dev/docs/api/checkout-ui-extensions/apis |
| Tutorials & use cases | https://shopify.dev/docs/apps/build/checkout |
| Bundle size analysis | https://shopify.dev/docs/apps/build/app-extensions#analyzing-bundle-size |
| Figma UI kit | https://www.figma.com/community/file/1554582792754361051 |
