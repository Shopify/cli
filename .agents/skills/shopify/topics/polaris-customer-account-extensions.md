# Customer Account UI extensions (Polaris)
Preact + `s-*` web-component extensions for customer account Order index, Order status, Profile, and full pages.

## Key facts
- Current stable API version: `2026-07` (quarterly `YYYY-MM`); set it as `api_version` in `shopify.extension.toml`. Validate: `shopify validate components --api polaris-customer-account-extensions --target <target> --version 2026-07 --file <f>` — `--target` required; pass `--version` (bundled default may lag).
- The React library (`@shopify/ui-extensions-react/customer-account`, `reactExtension`, `useApi`, `<BlockStack>`) is superseded. Current: Preact entry + globally registered web components, no component imports:
  `import '@shopify/ui-extensions/preact'; import {render} from 'preact'; export default () => render(<Extension/>, document.body);`
- APIs live on the global `shopify` object, not hooks. Reactive values are signals: `.value` or `.subscribe(fn)`.
- `navigation` is its own global — the validator rejects `shopify.navigation` though some docs show it. Use `navigation.navigate('extension://settings')`, `navigation.currentEntry`.
- `s-card` is NOT valid (validator rejects it; some shopify.dev examples use it) — use `s-section`/`s-box`.
- Order action targets get `shopify.orderId` (plain string) — `shopify.order` does not exist there. The `Order` signal (`id`, `name`, `confirmationNumber`, `processedAt`, `cancelledAt`) exists only on order-status targets and `order.page.render`.
- Tone enums (narrower than checkout): `s-badge`/`s-button` tone `auto|neutral|critical`; `s-button` variant `auto|primary|secondary`; `s-banner` tone `auto|info|success|warning|critical`; `s-text` adds `neutral|custom`.
- New: `customer-account.profile.payment.render-after` target (2026-07); unit tests via `@shopify/ui-extensions-tester` (2026-04+).
- Attributes are camelCase (`accessibilityLabel`, `gridTemplateColumns`); boolean shorthand only for boolean props (`<s-button disabled>`); keyword props need string values (`padding="base"`, never bare `padding`). No HTML comments in JSX.

## Targets (`[[extensions.targeting]]`, prefix `customer-account.`)
- Full page: `page.render` (merchant nav menu, own routing); `order.page.render` (adds order-status APIs).
- Order actions: `order.action.menu-item.render` (menu button); `order.action.render` (modal — root must be `s-customer-account-action`; gets `orderId` + `close()`).
- Order index: `order-index.block.render`, `.announcement.render`.
- Order status (all get order-status APIs): `order-status.block.render`, `.announcement.render`, + statics (all end `.render-after`): `.cart-line-item` (+current line), `.cart-line-list`, `.customer-information`, `.payment-details`, `.fulfillment-details` (+`fulfillmentId`), `.return-details` (+`returnId`), `.unfulfilled-items`.
- Profile: `profile.block.render`, `.announcement.render`, `.addresses.render-after`, `.payment.render-after`; B2B: `.company-details.render-after`, `.company-location-{addresses,payment,staff}.render-after` (+`companyLocationId`).
- `footer.render-after` (all pages).
Merchants position block targets in the checkout and accounts editor (max 3 per location).

## `shopify` global
All targets: `extension` (handle, capabilities) · `authenticatedAccount.customer`/`.purchasingCompany` (signals) · `settings` (signal) · `storage.read/write/delete(key)` (per-browser) · `sessionToken.get()` (JWT, 5-min expiry; fetch per request) · `toast.show(msg, {isError})` · `i18n.translate(key, {count})` + `formatNumber/formatCurrency/formatDate` · `localization.language/country` · `analytics.publish(name, data)`/`visitor({email})` · `intents.invoke({action:'open', type:'shopify/SubscriptionContract', value: gid, data:{field:'paymentMethod'}})` · `customerPrivacy` · `query(gql, {variables})` (Storefront; needs `api_access`) · `version`.
Order-status targets add: `order` · `lines` (CartLine[]: `merchandise`, `quantity`, `cost`; `id` unstable) · `cost` · `discountCodes`/`discountAllocations` · `appliedGiftCards` · `note` · `attributes` · `buyerIdentity` · `shippingAddress`/`billingAddress` · `appMetafields` (from toml metafields config; filter by `target.type`) · `shop` · `checkoutSettings` · `authenticationState` (`fully_authenticated|pre_authenticated`) · `requireLogin()`.
Data access: Customer Account GraphQL via `fetch('shopify://customer-account/api/2026-07/graphql.json', {method:'POST', ...})` — auto-authenticated. Own backend: `network_access` capability + Partner Dashboard approval; server must send `Access-Control-Allow-Origin: *` (Worker null origin); auth via Bearer session token.

## Components
Actions: `s-button` `s-button-group` `s-link` `s-clickable` `s-clickable-chip` `s-clipboard-item` `s-menu` `s-customer-account-action`. Feedback: `s-banner` `s-badge` `s-announcement` `s-progress` `s-spinner`. Forms: `s-form` `s-text-field` `s-text-area` `s-email-field` `s-phone-field` `s-password-field` `s-url-field` `s-number-field` `s-money-field` `s-date-field` `s-date-picker` `s-select`+`s-option` `s-checkbox` `s-switch` `s-choice-list`+`s-choice` `s-drop-zone` `s-consent-checkbox` `s-consent-phone-field`. Layout: `s-page` `s-section` `s-stack` `s-grid`+`s-grid-item` `s-box` `s-divider` `s-scroll-box`. Media: `s-image` `s-icon` `s-avatar` `s-product-thumbnail` `s-payment-icon` `s-qr-code` `s-map`. Overlays: `s-modal` `s-sheet` `s-popover` (open via `<s-button commandFor="id">`) `s-tooltip` (`interestFor`). Text: `s-heading` `s-paragraph` `s-text` `s-abbreviation` `s-time` `s-details`+`s-summary` `s-chip` `s-ordered-list`/`s-unordered-list`+`s-list-item` `s-skeleton-paragraph`.

## Config
```toml
api_version = "2026-07"

[[extensions]]
type = "ui_extension"
name = "Loyalty program"
handle = "loyalty-program"
uid = "4be0643f-1d98-e73b-17cd-ca98a65347dd"

  [[extensions.targeting]]
  target = "customer-account.order-status.block.render"
  module = "./src/OrderStatusBlock.tsx"

    [[extensions.targeting.metafields]]
    namespace = "loyalty"
    key = "tier"

  [extensions.capabilities]
  api_access = true
  network_access = true

  [extensions.settings]
    [[extensions.settings.fields]]
    key = "plan_name"
    type = "single_line_text_field"
    name = "Plan name"
```
`name` 5-30 chars (merchant-facing); `handle` immutable after deploy. Setting types: `boolean date date_time single_line_text_field multi_line_text_field number_integer number_decimal variant_reference`; max 20; all optional — code fallbacks.

## Examples
Order-status block (`customer-account.order-status.block.render`):
```tsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
export default () => render(<Extension />, document.body);
function Extension() {
  const order = shopify.order.value;
  if (!order) return <s-spinner accessibilityLabel="Loading" />;
  return (
    <s-section heading="Warranty">
      <s-stack direction="block" gap="base">
        <s-text>Order {order.name} covered until {shopify.i18n.formatDate(new Date(order.processedAt))}</s-text>
        <s-badge tone="auto">{shopify.settings.value.plan_name ?? 'Standard'}</s-badge>
        <s-button onClick={async () => {
          await shopify.storage.write('warranty_ack', order.id);
          shopify.toast.show('Saved');
        }}>Acknowledge</s-button>
      </s-stack>
    </s-section>
  );
}
```
Order action modal (`customer-account.order.action.render`):
```tsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
export default () => render(<Extension />, document.body);
function Extension() {
  return (
    <s-customer-account-action heading="Request a return">
      <s-text>Start a return for order {shopify.orderId}.</s-text>
      <s-button slot="primary-action" onClick={() => shopify.close()}>Submit</s-button>
      <s-button slot="secondary-action" onClick={() => shopify.close()}>Cancel</s-button>
    </s-customer-account-action>
  );
}
```
Full page (`customer-account.page.render`), Customer Account API + navigation:
```tsx
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
export default () => render(<Extension />, document.body);
function Extension() {
  const [name, setName] = useState('');
  useEffect(() => {
    fetch('shopify://customer-account/api/2026-07/graphql.json', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: '{customer {firstName}}'}),
    }).then((r) => r.json()).then(({data}) => setName(data.customer.firstName));
  }, []);
  return (
    <s-page heading={`Rewards for ${name}`}>
      <s-section heading="Balance">
        <s-paragraph>1200 points</s-paragraph>
        <s-button onClick={() => navigation.navigate('shopify:customer-account/orders')}>Back to orders</s-button>
      </s-section>
    </s-page>
  );
}
```

## Gotchas
- Compiled bundle ≤ 64 KB per extension (deploy-enforced).
- Sandbox is a Web Worker: no `window`/DOM; errors via `self.addEventListener('unhandledrejection'|'error', ...)`.
- Link protocols: `shopify:customer-account/orders|profile`, `extension:<handle>/<path>`, relative `/route`.
- Translations: `locales/en.default.json` per extension.
- Customer data requires protected-customer-data approval; pre-auth buyers may get `undefined` from protected fields — gate with `authenticationState` + `requireLogin()`.
- Workflow: `shopify app generate extension` → `shopify app dev` (needs dev store with test customer) → `shopify app deploy`.

## Docs
https://shopify.dev/docs/api/customer-account-ui-extensions/latest
https://shopify.dev/docs/api/customer-account-ui-extensions/latest/targets
https://shopify.dev/docs/api/customer-account-ui-extensions/latest/target-apis
https://shopify.dev/docs/api/customer-account-ui-extensions/latest/web-components
https://shopify.dev/docs/apps/build/app-extensions/configure-app-extensions
