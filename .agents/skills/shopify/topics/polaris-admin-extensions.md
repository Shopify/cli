# Admin UI extensions (Polaris)
Extensions inside the Shopify admin — action modals, resource-page blocks, print actions, admin links, Function settings UIs — Polaris web components (`s-*`) + Preact.

## Key facts

- Latest API version `2026-04` (`api_version` in `shopify.extension.toml`). Quarterly; deploys blocked for versions >12 months old.
- The React model is legacy: `2025-07` was the LAST version supporting `@shopify/ui-extensions-react/admin` (`reactExtension`, `useApi`). Since `2025-10`: Preact + globally registered `s-*` web components, no component imports. Deps: `preact ^10`, `@shopify/ui-extensions` ≥2025.10; tsconfig `"jsx": "react-jsx", "jsxImportSource": "preact"`.
- Entry point: default-export a function calling `render(<Extension />, document.body)` (`preact`). No target string in code — toml `[[extensions.targeting]]` binds `target` to `module`.
- APIs moved from `useApi()`/callback arg to a global `shopify` object; `shopify app dev` generates `shopify.d.ts` typing it.
- Renames: `title` → `heading` on `s-admin-action`/`s-admin-block`; `BlockStack`/`InlineStack` → `s-stack direction="block"|"inline"`; `Pressable` → `s-clickable`; `ProgressIndicator` → `s-spinner`; `HeadingGroup` removed; `<CustomerSegmentTemplate>` → data target returning `{templates: [...]}` (see Targets).
- Partners-Dashboard "admin links"/"bulk action links" → `admin_link` extensions; migrate with `shopify app import-extensions`.
- Compiled bundle ≤ 64 KB, enforced at `shopify app deploy`. Unit tests: `@shopify/ui-extensions-tester` (2026-04+).
- Validate offline: `shopify validate components --api polaris-admin-extensions --target <target> --file Ext.tsx`.

Scaffold: `shopify app generate extension --template admin_action|admin_block|admin_print|admin_link`. Actions: 1 target per extension. Blocks: merchant must add + pin before they render. `admin_link`: `type = "admin_link"` + `url` in toml, no code.

## shopify.extension.toml

```toml
api_version = "2026-04"

[[extensions]]
type = "ui_extension"
name = "t:name"
handle = "issue-tracker-action"
uid = "799a1dec-3979-a563-117b-d4e5cd6b9808fbc17d0d"

[[extensions.targeting]]
target = "admin.product-details.action.render"
module = "./src/ActionExtension.tsx"
```

`name` 5–30 chars (`t:key` reads `locales/en.default.json`; add `fr.json` etc.); `handle` `[a-zA-Z0-9-]` ≤100, immutable after deploy; `uid` unique per app. Translations: `shopify.i18n.translate('key')`.

## Targets

Pattern `admin.<surface>.<kind>.render`; action/print kinds also have `.should-render` variants.
- Details surfaces (`product|product-variant|order|customer|collection|draft-order|discount|gift-card|abandoned-checkout|catalog|company` + `-details`): all take `.action.*`; all but discount-details take `.block.render`. Also `company-location-details.block.render`, `customer-segment-details.action.*`, `order-fulfilled-card.action.*`.
- Index surfaces (`product|order|customer|collection|draft-order|discount` + `-index`): `.action.*`; all but collection-index also `.selection-action.*` (bulk)
- Print: `.print-action.*` on order-details, product-details; `.selection-print-action.*` on order-index, product-index
- Configuration: `admin.product-details.configuration.render` (+ variant twin; bundles); `admin.discount-details.function-settings.render`, `admin.settings.validation.render`, `admin.settings.order-routing-rule.render` (Function settings)
- Other: `admin.product-details.reorder.render`, `admin.product-purchase-option.action.render` (+ variant twin), `admin.customers.segmentation-templates.data`, `admin.app.tools.data`; links: `admin.product.action.link` etc.

## Global `shopify` object

| Member | Purpose |
|---|---|
| `data.selected` | `{id: string}[]` GIDs viewed/selected; query for other fields |
| `query(gql, {variables, version})` | Direct Admin GraphQL; returns `{data, errors}` |
| `close()` | Close action modal (action targets only) |
| `navigation.navigate(url)` | Block→action on same resource page (`extension:` protocol) |
| `resourcePicker({type, multiple, action, filter, selectionIds})` | `type: 'product'\|'variant'\|'collection'`; resolves selection array, `undefined` on cancel |
| `picker({heading, headers, items, multiple})` | Custom table picker; resolves `{selected}` |
| `intents.invoke(q, opts)` | Native create/edit workflow; `(await x.complete).code`: `'ok'\|'error'\|'closed'` |
| `i18n.translate/formatCurrency/formatNumber/formatDate` | Locale utilities |
| `storage.get/set/delete/clear` | Per-extension persistent browser storage |
| `auth.idToken()` | OpenID Connect JWT for your backend |
| `extension.target` | Running target id |

Intents: `'create:shopify/Product'` or `('edit:shopify/Product', {value: 'gid://shopify/Product/123'})`. Types: `shopify/` + `Article|Catalog|Collection|Customer|Discount|Location|Market|Menu|MetafieldDefinition|Metaobject|MetaobjectDefinition|Page|Product|ProductVariant`.

## Data access and auth

- Direct API: `shopify.query()` or POST `fetch('shopify:admin/api/graphql.json')` — auto-authenticated; online token by default (`direct_api_mode = "offline"` in app toml); scopes from the app's `[access_scopes]`.
- Own backend: `fetch()` to `app_url` or a relative path auto-adds an ID-token `Authorization` header; other domains: send `auth.idToken()` yourself and allow CORS origin `https://extensions.shopifycdn.com`.
- URL protocols: `shopify:admin/products/123`, `app:settings`, `extension:<handle>/<target>?issueId=1`, relative → app route.

## Components (no imports; camelCase attrs)

- Actions: `s-button s-button-group s-clickable s-clickable-chip s-link s-menu`
- Feedback: `s-badge s-banner s-spinner`
- Forms: `s-checkbox s-choice-list/s-choice s-color-field s-color-picker s-date-field s-date-picker s-drop-zone s-email-field s-form s-function-settings s-money-field s-number-field s-password-field s-search-field s-select/s-option/s-option-group s-switch s-text-area s-text-field s-url-field`
- Layout: `s-box s-divider s-grid/s-grid-item s-ordered-list/s-unordered-list/s-list-item s-query-container s-section s-stack s-table` (+header-row/header/body/row/cell)
- Media: `s-avatar s-icon s-image s-thumbnail`
- Wrappers: `s-admin-action s-admin-block s-admin-print-action`
- Typography: `s-chip s-heading s-paragraph s-text s-tooltip`

## Examples (validated)

Action modal — `admin.product-details.action.render`:

```tsx
import {render} from 'preact';
import {useState} from 'preact/hooks';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [note, setNote] = useState('');

  async function save() {
    await shopify.query(
      `mutation Set($input: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $input) { userErrors { message } }
      }`,
      {variables: {input: [{
        ownerId: shopify.data.selected[0].id,
        namespace: 'custom', key: 'note',
        type: 'single_line_text_field', value: note,
      }]}},
    );
    shopify.close();
  }

  return (
    <s-admin-action heading="Add note">
      <s-text-field label="Note" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
      <s-button slot="primary-action" variant="primary" onClick={save}>Save</s-button>
    </s-admin-action>
  );
}
```

Block with resource picker — `admin.product-details.block.render`:

```tsx
import {render} from 'preact';
import {useState} from 'preact/hooks';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [picked, setPicked] = useState(0);

  async function pick() {
    const selection = await shopify.resourcePicker({
      type: 'product',
      multiple: true,
      filter: {query: 'tag:featured', draft: false},
    });
    if (selection) setPicked(selection.length);
  }

  return (
    <s-admin-block heading="Related products">
      <s-stack direction="block" gap="base">
        <s-button onClick={pick}>Pick products</s-button>
        {picked > 0 && <s-badge tone="success">{picked} linked</s-badge>}
      </s-stack>
    </s-admin-block>
  );
}
```

Should-render — `admin.product-index.selection-action.should-render`:

```ts
export default () => {
  return {display: shopify.data.selected.length > 0 && shopify.data.selected.length <= 25};
};
```

Print action — `admin.order-details.print-action.render`: render `<s-admin-print-action src={url} />` the same way; `src` (full URL, app-relative path, or `app:`; HTML/PDF/image) becomes the preview and prints on click; unset `src` disables the Print button.

## Gotchas

- Should-render must return `{display: boolean}` — a bare boolean fails. It may be async and use `query`/Direct API `fetch` (`auth`, `storage` too); it renders no UI and runs after page load.
- `s-admin-action` buttons render only via `slot="primary-action"` / `slot="secondary-actions"`.
- Text inputs: `onInput`/`onChange` with `e.currentTarget.value` (`e.target.value` fails type-checking).
- Boolean attrs (`disabled`, `loading`) allow shorthand; string keyword attrs (`padding`, `gap`, `tone`, `variant`) need explicit values.
- No HTML comments `<!-- -->` in component markup — flagged as unknown components.
- `s-form` never submits over HTTP — handle its `submit` event; in blocks it wires into the admin contextual save bar.
- Function settings targets save via `applyMetafieldChange({type: 'updateMetafield', namespace, key, value})`, not direct mutations.

## Docs

https://shopify.dev/docs/api/admin-extensions/latest
https://shopify.dev/docs/api/admin-extensions/latest/targets
https://shopify.dev/docs/api/admin-extensions/latest/target-apis
https://shopify.dev/docs/api/admin-extensions/latest/web-components
https://shopify.dev/docs/apps/build/admin/upgrading-to-2025-10
https://shopify.dev/docs/apps/build/admin/actions-blocks/build-admin-action
https://shopify.dev/docs/apps/build/admin/actions-blocks/build-admin-print-action
