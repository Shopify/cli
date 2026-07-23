# POS UI extensions
Preact + Polaris web-component extensions embedded in Shopify POS (smart grid tiles, screen blocks, action menu items, modals, receipts, background events).

## Key facts
- Current stable API version: `2026-07` (quarterly `YYYY-MM`; CLI blocks deploys targeting versions >12 months old). Set in `shopify.extension.toml` `api_version`.
- Since `2025-10` the React model is legacy: `reactExtension('pos.home.modal.render', ...)` + `useApi()` from `@shopify/ui-extensions-react/point-of-sale`. Instead: default-export a function, `render(<X/>, document.body)` from `preact`, lower-case `s-*` web-component tags, APIs on the global `shopify` object (typed by the `shopify.d.ts` that `shopify app dev` generates). Deps: `preact ^10.10`, `@preact/signals ^2.3`, `@shopify/ui-extensions 2025.10+`; drop `react`, `react-reconciler`, `@shopify/ui-extensions-react`. Extension `tsconfig.json`: `"jsx":"react-jsx","jsxImportSource":"preact"`.
- Renames (legacy → web component): `Screen`→`s-page`, `ScrollView`→`s-scroll-box`, `SearchBar`→`s-search-field`, `RadioButtonList`→`s-choice-list`, `Dialog`→`s-modal`, `Selectable`→`s-clickable`, `Stepper`→`s-number-field`, `SegmentedControl`→`s-tabs`, `PrintPreview`→`s-embed`, `POSBlockRow`→`s-pos-block`. Removed: `List`, `Navigator`, `ActionItem` (use `s-button`). Replaced by APIs: `CameraScanner`→Scanner API, `PinPad`→PinPad API, `SmartGridApi`→Action API.
- `shopify.print` (Print API) is deprecated → `shopify.printing` (Printing API): `getPrinters()`, `print(src, {printer})` prints direct to a receipt printer, or system dialog when `printer` omitted.
- `2026-07` adds the app-background target `pos.app.ready.data` (runs once at POS ready, no UI) with `shopify.addEventListener`/`removeEventListener`; prefer it over the older `pos.*.event.observe` targets.

## Targets (exact names)
- Home: `pos.home.tile.render` (only `s-tile`), `pos.home.modal.render` (full component set).
- Detail screens, each with `.block.render`, `.action.menu-item.render`, `.action.render` (modal): `pos.product-details.*`, `pos.customer-details.*`, `pos.order-details.*`, `pos.draft-order-details.*`, `pos.register-details.*`, `pos.purchase.post.*`, `pos.return.post.*`, `pos.exchange.post.*`.
- Cart line item: `pos.cart.line-item-details.action.menu-item.render`, `pos.cart.line-item-details.action.render`.
- Receipts (print-only): `pos.receipt-header.block.render`, `pos.receipt-footer.block.render` — root `s-pos-block`; only `s-text` and `s-qr-code` (prop `content`) inside.
- Events (older, still valid): `pos.cart-update.event.observe`, `pos.transaction-complete.event.observe`, `pos.cash-tracking-session-start.event.observe`, `pos.cash-tracking-session-complete.event.observe`. Preferred `2026-07`: `pos.app.ready.data` + `shopify.addEventListener('transactioncomplete'|'cashtrackingsessionstart'|'cashtrackingsessioncomplete', cb)`; `TransactionCompleteEvent` narrows on `transactionType: 'Sale'|'Return'|'Exchange'`.
- Pattern: tile/menu-item calls `shopify.action.presentModal()` → POS presents the sibling `.action.render` (or `pos.home.modal.render`) target. `presentModal()` only works from a user interaction.

## `shopify` global APIs (availability varies by target)
| API | Key members |
|---|---|
| `action` | `presentModal()` |
| `toast` | `show(content)` |
| `session` | `currentSession {shopId, shopDomain, locationId, staffMemberId, userId, currency, posVersion}`, `getSessionToken()` (OpenID ID token; `undefined` without app permission — POS staff PINs aren't authenticated users), `deviceId`, `staffMember` (signal) |
| `cart` | `current` (signal), `addLineItem(variantId, qty)`, `addCustomSale`, `applyCartDiscount('Percentage'\|'FixedAmount'\|'Code', title, amount?)`, `addCartCodeDiscount(code)`, `setLineItemDiscount(uuid, 'Percentage'\|'FixedAmount', title, amount)` (FixedAmount is per-unit), `removeAllDiscounts(disableAutomaticDiscounts)`, `setCustomer`, `addLineItemProperties(uuid, props)`, `setAttributedStaff(staffId)`, `bulkCartUpdate`, `clearCart()`. App-background gets read-only `cart.current` |
| `cartLineItem` | selected line item (uuid, title, price, sku, quantity, discounts, properties, `isGiftCard`, `requiresSellingPlan`) on line-item targets |
| `customer` / `product` / `order` / `draftOrder` | context ids: `customer.id`; `product.{id, variantId}`; `order.{id, name, customerId}`; `draftOrder.{id, name, customerId}` |
| `productSearch` | `searchProducts(params)` (≤50/page, `afterCursor`), `fetchProductWithId`, `fetchProductsWithIds`, `fetchProductVariantsWithProductId`, `fetchPaginatedProductVariantsWithProductId` |
| `storage` | `get`, `set`, `delete`, `clear`, `entries` — max 100 entries, ~1 KB keys, ~1 MB JSON-serializable values |
| `printing` | `getPrinters()`, `print(src, options?)` — src (same origin as `application_url`): HTML, image, or PDF; PDFs print only via system dialog — passing a `printer` with a PDF throws |
| `scanner` | `scannerData.current` (signal), `sources`, `showCameraScanner()`, `hideCameraScanner()` — dedupe repeats; unsubscribe on unmount |
| `connectivity` | `current.value.internetConnected: 'Connected'\|'Disconnected'` (signal) |
| `navigation` (own global, not on `shopify`) | `navigate(url, {state}?)`, `back()`, `currentEntry` — URL screens inside modals |
| `cashDrawer` | `open()` |
| `device`, `locale`, `pinPad`, `camera` | device info/GID, merchant locale, PIN entry modal, photo capture |

Signals expose `{value, subscribe(fn) => unsubscribe}`.

## Config — `shopify.extension.toml`
```toml
api_version = "2026-07"

[[extensions]]
type = "ui_extension"
name = "Loyalty tools"
handle = "loyalty-tools"
description = "Loyalty lookup and discounts"

[extensions.supported_features]
runs_offline = true

[[extensions.targeting]]
target = "pos.home.tile.render"
module = "./src/Tile.tsx"

[[extensions.targeting]]
target = "pos.home.modal.render"
module = "./src/Modal.tsx"
```
Scaffold with `shopify app generate extension` (pick "POS smart grid"); never hand-create the app structure. `runs_offline` needs POS ≥11.0 and CLI ≥3.92; offline excludes fetch/Direct API.

## Examples (validated)
Tile (`pos.home.tile.render`):
```tsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<Tile />, document.body);
};

function Tile() {
  return (
    <s-tile
      heading="Loyalty"
      subheading="Check points"
      onClick={() => shopify.action.presentModal()}
    />
  );
}
```
Modal with cart ops (`pos.home.modal.render`):
```tsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<Modal />, document.body);
};

function Modal() {
  async function applyDiscount() {
    try {
      await shopify.cart.applyCartDiscount('Percentage', 'Staff perk', '10');
      shopify.toast.show('10% discount applied');
    } catch (error) {
      shopify.toast.show('Discount failed');
    }
  }
  return (
    <s-page heading="Discounts">
      <s-section heading="Cart">
        <s-text>{`Items: ${shopify.cart.current.value.lineItems.length}`}</s-text>
        <s-button variant="primary" onClick={applyDiscount}>
          Apply 10% off
        </s-button>
      </s-section>
    </s-page>
  );
}
```
Block (`pos.product-details.block.render`; `s-pos-block` takes only `heading`/`id` + `secondary-actions` slot):
```tsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default async () => {
  render(<Block />, document.body);
};

function Block() {
  return (
    <s-pos-block heading="Fit notes">
      <s-box paddingBlock="base">
        <s-text>{`Product ${shopify.product.id}`}</s-text>
      </s-box>
      <s-button slot="secondary-actions" onClick={() => shopify.action.presentModal()}>
        Edit
      </s-button>
    </s-pos-block>
  );
}
```
Background listener (`pos.app.ready.data`, 2026-07; register host events with `shopify.addEventListener` as above):
```tsx
export default function extension() {
  shopify.cart.current.subscribe((cart) => {
    shopify.storage.set('lineItemCount', String(cart.lineItems.length));
  });
}
```

## Network, auth, gotchas
- Backend calls: plain `fetch` to your app domain auto-attaches an Authorization header; relative URLs resolve against `application_url` (POS ≥10.6, api_version ≥2025-07).
- Direct Admin API: `fetch('shopify:admin/api/graphql.json', {method: 'POST', body: JSON.stringify({query, variables})})` — declare access scopes in the app TOML; scopes register on deploy+install.
- Compiled bundle ≤64 KB, enforced at `shopify app deploy`.
- JSX attrs are camelCase (`paddingBlock`, `alignItems`); keyword props need string values (`gap="base"`, never `gap={true}`); boolean props allow shorthand (`disabled`, `loading`).
- `s-button`: `variant 'primary'|'secondary'`, `tone 'auto'|'neutral'|'caution'|'warning'|'critical'`. `s-tile`: `heading`, `subheading`, `itemCount`, `disabled`, `tone`. Inline `s-modal` opens via `<s-button command="--show" commandFor="modal-id">`.
- Localization: `locales/en.default.json` (+ `fr.json`) per extension; `name`/`description` accept `t:` keys.
- Testing: dev store + POS app (`shopify app dev`); unit tests: `@shopify/ui-extensions-tester` (2026-04+). ESLint global: `shopify`.
- Validate components before shipping: `shopify validate components --api pos-ui --target <target> --file <f>` (`--target` required; bundled schema may trail latest docs version).

## Docs
https://shopify.dev/docs/api/pos-ui-extensions/latest
https://shopify.dev/docs/api/pos-ui-extensions/latest/targets
https://shopify.dev/docs/api/pos-ui-extensions/latest/target-apis
https://shopify.dev/docs/api/pos-ui-extensions/latest/web-components
https://shopify.dev/docs/api/pos-ui-extensions/latest/targets/app-background
https://shopify.dev/docs/apps/build/pos/getting-started
https://shopify.dev/docs/apps/build/pos/upgrading-to-2025-10
