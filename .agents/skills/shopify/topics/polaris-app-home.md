# Polaris App Home
The app's main UI embedded in the Shopify admin iframe: Polaris web components (`s-*`) inside, App Bridge `shopify` global + admin-chrome elements outside.

## Corrections to stale training data
- Two build models: **iframe app** (recommended; any framework, self-hosted) and **App Home UI extension** (target `admin.app.home.render`, Preact-only, 64 kB, custom distribution). Below = iframe model.
- Polaris React (`@shopify/polaris`) is legacy here. `s-*` components are custom HTML elements auto-registered by `<script src="https://cdn.shopify.com/shopifycloud/polaris.js">` — **no import, ever**. Types: `@shopify/polaris-types`. `@shopify/polaris-web-components` doesn't exist.
- App Bridge = `<meta name="shopify-api-key">` + `<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js">` in `<head>` → `shopify` global. v3 `createApp` is legacy; types `@shopify/app-bridge-types`; React `useAppBridge()` returns the same global.
- `ui-title-bar`/`<TitleBar>` and `ui-nav-menu`/`<NavMenu>` are superseded: title bar = **slots on `s-page`** (`primary-action`, `secondary-actions`, `breadcrumb-actions`, `accessory`); nav = `<s-app-nav>` of `s-link`s.
- Polaris React `Modal` is deprecated → `s-modal` (auto in-app vs fullscreen; `commandFor`/`command` or `shopify.modal.show(id)`). Fullscreen route window: `<s-app-window src="/route">`. `ui-modal` is legacy.
- **`s-form` doesn't exist in App Home** (UI-extension surfaces only); use native `<form data-save-bar>`.
- `s-page` takes `heading` (not `title`); `inlineSize` only `small|base|large`.
- `await shopify.idToken()` → JWT; same-domain `fetch()` gets `Authorization: Bearer <idToken>` automatically — never attach tokens manually. Browser Admin GraphQL: `fetch('shopify:admin/api/graphql.json')` (version-pin `2025-04`); requires direct API access in `shopify.app.toml`.

## Components (`s-*`, no import)
| Group | Tags |
|---|---|
| Actions | `s-button` `s-button-group` `s-link` `s-clickable` `s-clickable-chip` `s-menu` |
| Feedback | `s-badge` `s-banner` `s-spinner` |
| Forms | `s-checkbox` `s-choice-list`+`s-choice` `s-color-field` `s-color-picker` `s-date-field` `s-date-picker` `s-drop-zone` `s-email-field` `s-money-field` `s-number-field` `s-password-field` `s-search-field` `s-select`+`s-option` `s-switch` `s-text-area` `s-text-field` `s-url-field` |
| Layout | `s-page` `s-section` `s-box` `s-stack` `s-grid` `s-divider` `s-query-container` `s-ordered-list` `s-unordered-list` `s-list-item` |
| Table | `s-table` (`paginate hasNextPage hasPreviousPage loading variant="auto|table|list"`, events `nextpage`/`previouspage`) > `s-table-header-row` > `s-table-header` (`listSlot="primary|secondary|kicker|inline|labeled"`, `format="base|currency|numeric"`); `s-table-body` > `s-table-row` > `s-table-cell` |
| Overlays | `s-modal` (slots `primary-action`/`secondary-actions`) `s-popover` |
| Media | `s-avatar` `s-icon` `s-image` `s-thumbnail` |
| Typography | `s-chip` `s-heading` `s-paragraph` `s-text` `s-tooltip` |
| Admin chrome | `s-app-nav` `s-app-window` `ui-save-bar` |

Rules: camelCase props (`commandFor`, `gridTemplateColumns`). Boolean props take shorthand (`<s-banner dismissible>`); keyword props need strings (`padding="base"`, never `{true}`). `onInput` per keystroke, `onChange` on commit; values are always strings — `e.currentTarget.value` (`.values` for multi `s-choice-list`). Controlled = `value`, uncontrolled = `defaultValue`; every input needs `name`. Scale: `small-500…small|base|large…large-500`. Responsive values: `"@container (inline-size > 500px) large-400, small"` (inside `s-query-container`). Commands: `commandFor="<id>"` + `command="--show|--hide|--toggle|--auto|--copy"`. `href` renders an anchor, `onClick` a button; `target="auto"` = same tab internal, new tab external; no nested interactives. Custom CSS can't override internals.

## App Bridge `shopify` global
| API | Call |
|---|---|
| toast | `shopify.toast.show(msg, {duration, action, onAction, onDismiss, isError})` |
| saveBar | `shopify.saveBar.show/hide/toggle(id)` (`<ui-save-bar id>`), `leaveConfirmation()` before programmatic nav |
| resourcePicker | `await shopify.resourcePicker({type:'product'\|'variant'\|'collection', multiple, filter:{draft,archived,variants,hidden,query}, selectionIds})` → array, `undefined` on cancel |
| picker (app data) | `const p = await shopify.picker({heading, headers, multiple, items}); await p.selected` (items: `{id,heading,data,badges}`) |
| intents | `const a = await shopify.intents.invoke('create:shopify/Product'); (await a.complete).code` → `'ok'\|'closed'\|'error'` |
| scopes | `query()` → `{granted,required,optional}`; `request(['write_orders'])` → `{result:'granted-all'\|'declined-all', detail}`; `revoke([...])` (optional only) |
| loading / reviews | `shopify.loading(true\|false)`; `await shopify.reviews.request()` → `{success, code, message}` |
| config / environment | `shopify.config.shop/.locale/.apiKey/.disabledFeatures`; `shopify.environment` → `{embedded, mobile, pos}` |
| user | `await shopify.user()` → account access (POS adds id/name/email) |
| scanner | `const {data: barcode} = await shopify.scanner.capture()` |
| print / share | `window.print()` / `navigator.share()`, intercepted on Mobile/POS; no `files` |
| pos | `shopify.pos.cart.*`, `shopify.pos.device()` |
| webVitals / support | `shopify.webVitals.onReport(cb)`; `shopify.support.registerHandler(cb)` |

Navigation: anchors — `<a href="/settings">` (in-app), `<a href="shopify://admin/products/123" target="_top">` (admin). Intents: `create|edit:shopify/{Article,Catalog,Collection,Customer,DeliveryProfile,Discount,Location,Market,Menu,MetafieldDefinition,Metaobject,MetaobjectDefinition,Page,Product,ProductVariant}`, `pick:shopify/File`, `edit:settings/*`. Discount create needs `data.type` `'amount-off-product'|'amount-off-order'|'buy-x-get-y'|'free-shipping'`; edits need `value: 'gid://…'`.

## Examples (validated)
Page + title-bar slots + paginated table (tsx):
```tsx
export default function Dashboard() {
  const openProductPicker = async () => {
    const selected = await shopify.resourcePicker({type: 'product', multiple: 3});
    if (selected) shopify.toast.show(`${selected.length} products selected`);
  };
  return (
    <s-page heading="Dashboard">
      <s-badge slot="accessory" tone="success">Live</s-badge>
      <s-button slot="primary-action" variant="primary" onClick={openProductPicker}>Add products</s-button>
      <s-section heading="Orders">
        <s-table paginate hasNextPage>
          <s-table-header-row>
            <s-table-header listSlot="primary">Order</s-table-header>
            <s-table-header listSlot="labeled" format="currency">Total</s-table-header>
          </s-table-header-row>
          <s-table-body>
            <s-table-row><s-table-cell>#1042</s-table-cell><s-table-cell>$182.50</s-table-cell></s-table-row>
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}
```
Form + auto save bar + direct Admin API (tsx):
```tsx
export default function Settings() {
  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    const res = await fetch('shopify:admin/api/graphql.json', {
      method: 'POST',
      body: JSON.stringify({query: `query { shop { name } }`}),
    });
    const {data} = await res.json();
    shopify.toast.show(`Saved for ${data.shop.name}`);
  };
  return (
    <s-page heading="Settings" inlineSize="small">
      <form data-save-bar onSubmit={handleSubmit}>
        <s-section heading="Notifications">
          <s-stack gap="base">
            <s-text-field label="Sender name" name="senderName" defaultValue="Acme" required />
            <s-email-field label="Reply-to" name="replyTo" autocomplete="email" />
          </s-stack>
        </s-section>
      </form>
    </s-page>
  );
}
```
Nav + declarative modal (html):
```html
<s-app-nav>
  <s-link href="/app">Home</s-link>
  <s-link href="/app/settings">Settings</s-link>
</s-app-nav>
<s-button tone="critical" commandFor="delete-modal" command="--show">Delete</s-button>
<s-modal id="delete-modal" heading="Delete product?">
  <s-paragraph>This action cannot be undone.</s-paragraph>
  <s-button slot="secondary-actions" commandFor="delete-modal" command="--hide">Cancel</s-button>
  <s-button slot="primary-action" variant="primary" tone="critical" commandFor="delete-modal"
    command="--hide" onclick="shopify.toast.show('Product deleted')">Delete</s-button>
</s-modal>
```

## shopify.app.toml
```toml
[access_scopes]
scopes = "read_products,write_products"

[access.admin]
embedded_app_direct_api_access = true
direct_api_mode = "online"   # or "offline"
```

## Gotchas
- One save-bar mechanism per form — `data-save-bar` (Save→`submit`, Discard→`reset`; `data-discard-confirmation` adds a prompt) or `shopify.saveBar`, never both. `data-save-bar` misses React state changes; bridge with a hidden input dispatching a native `input` event.
- Route (`src`) modal/app-window frames are separate pages: re-include app-bridge.js + CSS/JS; only `environment` works inside — reach the parent via `postMessage` (`window.opener` ↔ `element.contentWindow`).
- `s-modal` HTML content moves into an admin-rendered iframe — `<script>`/`template` tags aren't copied; DOM-hungry libs (drag-drop) need a `src` route or `s-app-window`.
- `resourcePicker` `{type:'product', multiple:false}` still allows picking several variants of one product.
- `<button variant="primary">` inside `ui-save-bar` and `rel="home"` on `s-app-nav` links fail TSX type-checking — plain-HTML only.
- Validator: tsx default, `--language html` for raw HTML, no `--target`.

## Docs
https://shopify.dev/docs/api/app-home
https://shopify.dev/docs/api/app-home/web-components
https://shopify.dev/docs/api/app-home/app-bridge-web-components
https://shopify.dev/docs/api/polaris/using-polaris-web-components
https://shopify.dev/docs/api/app-home/patterns
