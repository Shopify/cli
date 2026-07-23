# Checkout UI extensions (Polaris)
Checkout and Thank-you page app extensions: Preact + Polaris web components, configured in `shopify.extension.toml`, proven with `shopify validate components --api polaris-checkout-extensions --target <target>`.

## Corrections to stale knowledge
- Latest docs version `2026-07` (quarterly; deploys older than 12 months rejected). Offline validator bundles up to `2026-04`.
- The React model is legacy (pre-`2025-10`): `reactExtension(...)`, `@shopify/ui-extensions-react`, `useApi()` hooks. Now: the module default-exports a function calling Preact `render(<Extension/>, document.body)` after `import '@shopify/ui-extensions/preact'`; APIs live on a global `shopify` object. Deps `preact ^10.10`, `@preact/signals`, `@shopify/ui-extensions 2026.x`; tsconfig `"jsxImportSource": "preact"`; `shopify app dev` generates `shopify.d.ts`.
- `s-*` components are globally registered — never import them. Attributes are camelCase (`gridTemplateColumns`), not kebab-case. Boolean attrs (`disabled`, `checked`, `multiple`) allow shorthand; string keyword attrs (`padding`, `gap`, `tone`, `variant`, `size`, `direction`) must be strings — `gap={true}` fails.
- `useBuyerJourneyIntercept`/`buyerJourney.intercept` is deprecated — use a cart/checkout validation function; the rest of Buyer Journey API remains.
- Checkout metafields removed in `2026-04`: `shopify.metafields`, `useMetafield(s)()`, change types `updateMetafield`/`removeMetafield` are gone. Read `shopify.appMetafields` (declare `[[extensions.metafields]]` in toml); write with `updateCartMetafield`/`removeCartMetafield` (thank-you targets read-only). Copying to orders needs `write_orders` + an order metafield definition with `cart_to_order_copyable`.
- `purchase.order-status.*` targets moved to customer account UI extensions. Thank-you exposes only `shopify.orderConfirmation` (`{order: {id}, number, isFirstOrder}`).
- API values are signals (`SubscribableSignalLike<T>`): read `.value`, `.subscribe(fn)` — not plain values.
- `shopify.buyerIdentity` needs protected customer data approval: `customer`/`purchasingCompany` level 1, `email`/`phone` level 2; `customer` is `undefined` for anonymous buyers.
- Shopify Plus only: information/shipping/payment-step extensions; pickup-point targets early access. Thank-you: all plans except Starter.
- The validator rejects HTML comments (`<!-- -->`).

## Config (`shopify.extension.toml`)
```toml
api_version = "2026-07"

[[extensions]]
type = "ui_extension"
name = "Gift options"
handle = "gift-options"
uid = "0fd21e56-9c34-4d61-bf45-8e2b0a3c7d18"

[extensions.capabilities]
api_access = true

[[extensions.targeting]]
target = "purchase.checkout.block.render"
module = "./src/Checkout.jsx"
default_placement = "ORDER_SUMMARY2"

[extensions.settings]
[[extensions.settings.fields]]
key = "banner_title"
type = "single_line_text_field"
name = "Banner title"
```
`name` 5–30 chars; `handle` ≤50, immutable after deploy; `uid` CLI-generated. Capabilities: `api_access`, `network_access`, `block_progress`, `collect_buyer_consent`. Settings: ≤20 fields; types `boolean single_line_text_field multi_line_text_field number_integer number_decimal date date_time variant_reference`; all optional — handle unset. Readable metafields: `[[extensions.metafields]]` with `namespace` + `key`. One module per target. Compiled bundle ≤64 KB.

## Targets
- Block (movable, ≤3 extensions/slot): `purchase.checkout.block.render`. Placement refs `WALLETS1 INFORMATION1-3 DELIVERY1-2 PAYMENT1-4 ORDER_SUMMARY1-4`; preview with `?placement-reference=NAME`.
- Checkout static (hidden with their section): `purchase.checkout.{delivery-address,shipping-option-list,pickup-location-list,pickup-point-list,payment-method-list,reductions}.render-before|render-after`; `purchase.checkout.{header,contact,shipping-option-item,pickup-location-option-item,cart-line-list,cart-line-item,footer}.render-after` (`cart-line-item`: per line, `shopify.target` = that CartLine); `purchase.checkout.shipping-option-item.details.render`; `purchase.checkout.actions.render-before`; `purchase.checkout.chat.render`.
- Runnable (no UI): `purchase.address-autocomplete.suggest` / `.format-suggestion`.
- Thank-you: `purchase.thank-you.{block.render, announcement.render, chat.render, header.render-after, customer-information.render-after, cart-line-list.render-after, cart-line-item.render-after, footer.render-after}`.

## Global `shopify` surface (signals unless noted)
| Member | Notes |
|---|---|
| `lines`; `applyCartLinesChange({type, ...})` | `addCartLine` (`merchandiseId`, `quantity`), `removeCartLine`/`updateCartLine` (need current `id`; IDs unstable — reread `lines`) |
| `attributes`; `applyAttributeChange({type: 'updateAttribute', key, value})` | Values always strings |
| `appMetafields`; `applyMetafieldChange({type: 'updateCartMetafield', metafield: {namespace, key, type, value}})` | Also `removeCartMetafield` |
| `note`; `applyNoteChange({type: 'updateNote' \| 'removeNote'})` | Order note |
| `discountCodes`, `discountAllocations`; `applyDiscountCodeChange({type: 'addDiscountCode' \| 'removeDiscountCode', code})` | Codes case-insensitive |
| `appliedGiftCards`; `applyGiftCardChange({type: 'addGiftCard' \| 'removeGiftCard'})` | Gift cards |
| `cost.{subtotalAmount, totalAmount, totalTaxAmount, totalShippingAmount}` | Each `Money {amount: number, currencyCode}` |
| `instructions` | Flags: `lines.canAddCartLine`, `discounts.canUpdateDiscountCodes`, `notes.canUpdateNote` — check before apply* |
| `buyerJourney.{activeStep, completed, steps}` | Step handles: `cart checkout information shipping payment review thank-you unknown` |
| `storage.read/write/delete(key)` | Per-extension KV (localStorage); cleared on new checkout |
| `sessionToken.get()` | 5-min JWT for your backend |
| `settings` | Merchant values keyed by settings field `key` |
| `localization`; `i18n.{translate, formatCurrency, formatNumber, formatDate}` | `translate()` reads only the extension's `locales/*.json` |
| `analytics.publish(name, payload)` / `.visitor(data)` | publish → web pixels only; visitor → shop backend only |
| `query(gql, {variables?, version?})` | Storefront API (needs `api_access`); alt `fetch('shopify:storefront/api/graphql.json')` |
| `buyerIdentity`, `shippingAddress`, `deliveryGroups`, `availablePaymentOptions`, `selectedPaymentOptions` | Read-only checkout state |
| `extension.{editor, capabilities}`, `shop`, `checkoutToken`, `customerPrivacy`, `orderConfirmation` (thank-you) | Context |

## Examples (validated)
Attribute + settings (`--target purchase.checkout.block.render`):
```jsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const heading = shopify.settings.value.banner_title ?? 'Gift options';
  async function onChange(event) {
    await shopify.applyAttributeChange({
      type: 'updateAttribute',
      key: 'giftWrap',
      value: event.target.checked ? 'yes' : 'no',
    });
  }
  return (
    <s-section heading={heading}>
      <s-checkbox label="Add gift wrap" name="giftWrap" onChange={onChange} />
    </s-section>
  );
}
```
Upsell: Storefront query + cart line add (same target; needs `api_access`):
```jsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [variantId, setVariantId] = useState(null);
  const canAdd = shopify.instructions.value.lines.canAddCartLine;
  useEffect(() => {
    shopify
      .query(`query { product(handle: "gift-box") { variants(first: 1) { nodes { id } } } }`)
      .then(({data}) => setVariantId(data?.product?.variants?.nodes[0]?.id));
  }, []);
  if (!canAdd || !variantId) return null;
  async function addGiftBox() {
    await shopify.applyCartLinesChange({
      type: 'addCartLine',
      merchandiseId: variantId,
      quantity: 1,
    });
  }
  return (
    <s-banner heading="Add a gift box">
      <s-button onClick={addGiftBox}>Add to order</s-button>
    </s-banner>
  );
}
```
Thank-you (`--target purchase.thank-you.block.render`): same skeleton; render `shopify.orderConfirmation.value?.number` in an `s-banner`.

## Gotchas
- apply* methods are rate limited per buyer session (then blocked entirely); batch with `Promise.all`. `applyCartLinesChange` takes ONE change per call and errors under accelerated checkout (Apple/Google Pay) or when the instruction flag is false. Results are `{type: 'success' | 'error'}`; error `message` is debug-only, unlocalized — render your own feedback.
- Runs in a Web Worker: no `window`/DOM; errors via `self.addEventListener('error' | 'unhandledrejection')`; third-party `fetch` needs `network_access`; trust only session-token claims server-side.
- Scaffold: `shopify app generate extension --template checkout_ui`; dev: `shopify app dev`; deploy: `shopify app deploy`. Unit tests: `@shopify/ui-extensions-tester` (2026-04+).
- Form events: `onInput` per keystroke, `onChange` on commit (blur); values are strings (`e.currentTarget.value`; multi-select `.values`). Every input needs `name` and `label`.
- Common components — layout `s-stack s-box s-grid s-section`; content `s-heading s-text s-paragraph s-badge s-banner s-image s-link`; forms `s-form s-button s-checkbox s-switch s-choice-list/s-choice s-select/s-option s-text-field s-number-field s-email-field s-text-area`; overlays `s-modal s-popover s-sheet s-tooltip` (open via `<s-button commandFor="id" command="--show">`).

## Docs
https://shopify.dev/docs/api/checkout-ui-extensions/latest
https://shopify.dev/docs/api/checkout-ui-extensions/latest/targets
https://shopify.dev/docs/api/polaris/using-polaris-web-components
https://shopify.dev/docs/apps/build/checkout/migrate-to-web-components
