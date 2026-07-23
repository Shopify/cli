# Merchant onboarding
Take a merchant from "I want to start selling" to a working store: instant preview-store creation via Shopify CLI, opening/saving the store, seeding products and collections, publishing to the Online Store channel, plain-language next steps. Store owners, not developers.

## Corrections to stale knowledge
- Preview stores exist and are the default first step: `shopify store create preview` creates a real, working Shopify store with **no account, no signup, no browser, no credit card**. Do not route new merchants to shopify.com free-trial signup first — that flow is superseded for agent-driven onboarding.
- `shopify store create preview --json` returns `{status, message, store: {id, name, subdomain, country?, storefrontUrl}, next_steps}`. There is **no `saveUrl` in the create output** — read it later from `shopify store info --json` (fields `saveUrl`, `accessUrl`).
- Preview-store creation silently stores an Admin API token locally (with preapproved scopes granted at creation). `shopify store execute` works on the preview store immediately — no `shopify store auth` needed. Preview stores are not a logged-in experience, so extra scopes **cannot** be granted later.
- `shopify store execute`, `store graphiql`, and `store bulk execute` block mutations by default; pass `--allow-mutations` to write.
- Current stable Admin GraphQL version: `2026-07` (CLI store commands default to latest stable; override with `--version`). REST Admin API is legacy — use GraphQL.
- Old CLI 2.x commands (`shopify populate`, `shopify login`) are gone. Seed data via Admin GraphQL through `store execute`.
- CLI requires Node.js ≥ 22.12. Install: `npm install -g @shopify/cli@latest` (or macOS: `brew tap shopify/shopify && brew install shopify-cli`). CLI 4.x auto-upgrades itself; force with `shopify upgrade`; toggle with `shopify config autoupgrade off|on`.
- New stores default to the `Horizon` theme (Dawn superseded).

## `shopify store` command surface
| Command | Purpose |
|---|---|
| `store create preview` | Create a preview store. Flags: `--name` (env `SHOPIFY_FLAG_PREVIEW_STORE_NAME`), `--country` (2-letter, e.g. `US`,`CA`,`GB`; env `SHOPIFY_FLAG_STORE_COUNTRY`), `-j, --json` |
| `store open -s <domain>` | Open storefront in browser (preview stores: tokenized access URL; others: `https://<subdomain>`) |
| `store info -s <domain> --json` | Store metadata: `id`, `displayName`, `subdomain`, org, `storeOwner`, `type`, `plan`, `featurePreview`, `adminUrl`, `accessUrl`, `saveUrl`, `authScopes` (last three: preview stores) |
| `store list` | Stores in an org; `--organization-id` required non-interactively (`shopify organization list` for IDs) |
| `store auth -s <domain> --scopes <csv>` | Store an online Admin token for non-preview stores; re-run on expiry/missing scopes |
| `store auth list` | Stores authenticated locally via `store auth` |
| `store execute -s <domain>` | Run Admin GraphQL. Flags: `-q/--query`, `--query-file`, `-v/--variables`, `--variable-file`, `--output-file`, `--version`, `--allow-mutations`, `--json` |
| `store graphiql -s <domain>` | Local GraphiQL for Admin API; `--port` (1–65535) |
| `store bulk execute\|status\|cancel` | Async bulk Admin GraphQL on a store |

## Flow: brand-new merchant
1. First-store / "try Shopify" / "start selling" intent → create the preview store **immediately**. No signup detour, no country question, no name workshop; ask one clarifying question only if there is zero signal (no brand, product, or audience). Quote the name: `--name 'Peak Candle Co'`. Omit `--name` to let the CLI generate one (tell the merchant; renameable later).
2. Open it: `shopify store open --store <store.subdomain from JSON>`.
3. Build in merchant language: add products → edit theme → set up shipping (soft default order). Publish sample products to the Online Store channel or buyers won't see them.
4. Nudge toward saving once every 3–4 turns of real work: the storefront preview shows a persistent black footer bar with a `Save store` button — that is the canonical keep/claim path (or the `saveUrl` from `store info --json`). Never invent a signup flow or lead with plan selection/billing.

## Examples
Create and open:
```bash
shopify store create preview --name 'Peak Candle Co' --json
shopify store open --store peak-candle-co.myshopify.com
```
Seed a product (preview store: token already stored, no auth step):
```bash
shopify store execute --store peak-candle-co.myshopify.com --allow-mutations \
  --query 'mutation { productCreate(product: {title: "Cedar Smoke Candle", productType: "Home", vendor: "Peak Candle Co", status: ACTIVE}) { product { id title } userErrors { field message } } }'
```
Find the Online Store publication, then publish the product to it:
```bash
shopify store execute --store peak-candle-co.myshopify.com \
  --query 'query { publications(first: 20) { nodes { id catalog { title } } } }'
shopify store execute --store peak-candle-co.myshopify.com --allow-mutations \
  --query 'mutation { publishablePublish(id: "gid://shopify/Product/8710293422160", input: [{publicationId: "gid://shopify/Publication/172556370"}]) { publishable { ... on Product { id } } userErrors { field message } } }'
```

Create output shape (`--json`):
```json
{
  "status": "success",
  "message": "Your Shopify store \"Peak Candle Co\" is ready. This store is temporary. Create a free Shopify account to save it and start selling.",
  "store": {
    "id": "82635801",
    "name": "Peak Candle Co",
    "subdomain": "peak-candle-co.myshopify.com",
    "storefrontUrl": "https://peak-candle-co.myshopify.com/?_ab=0&key=1721745600"
  },
  "next_steps": [
    "Use `shopify store open --store peak-candle-co.myshopify.com` to preview the storefront.",
    "Use `shopify store execute --store peak-candle-co.myshopify.com` to add products, collections, pages, and more.",
    "Use `shopify theme pull --store peak-candle-co.myshopify.com` and `shopify theme push --store peak-candle-co.myshopify.com` to edit your store design."
  ]
}
```

## Publishing model (why step 3 needs it)
Catalogs: `AppCatalog` (sales channels, e.g. Online Store, Point of Sale), `MarketCatalog`, `CompanyLocationCatalog`. Each catalog has a publication; buyers see only published resources. `Publishable` is implemented by `Product`, `ProductVariant`, `Collection`. Mutations: `publishablePublish`, `publishableUnpublish` (both take `id` + `input: [PublicationInput!]!`); `publishablePublishToCurrentChannel(id:)` is deprecated. Scopes: `read_publications`/`write_publications` (+`read_products`). Filter with `publications(first: 20, catalogType: APP)` (`CatalogType`: `APP|MARKET|COMPANY_LOCATION|NONE`). Collections: `collectionCreate(collection: CollectionCreateInput)` (`input: CollectionInput` is deprecated), scope `write_products`, unavailable on Starter/Retail plans. Product must have `status: ACTIVE` to be visible; `requiresSellingPlan: true` products publish only to online stores; scheduled (future) publishing works only on online-store channels.

## Merchant-language rules
- Never say "preview store" to the merchant — it's simply their Shopify store. Truthful framing: free to build on now; can't take real orders or payments yet.
- Preview limits are non-negotiable: no real payments, real orders, app installs, or staff accounts until they save the store and subscribe. If asked: "Not yet — that unlocks when you save your store and subscribe to Shopify."
- Pricing question → "It's free to create an account and save your store. Pricing kicks in when you're ready to sell and accept payments."
- Saving: name the exact `Save store` button (footer of the storefront preview) or give `saveUrl`. Products, theme changes, and pages carry over. Selling, payments, and subscription setup come after saving — never before.
- Hide plumbing: no raw JSON, tokens, scopes, GraphQL, or TOML in merchant-facing replies. Don't foreground `accessUrl`/`adminUrl`; URLs, button names, and single commands are fine when they're the merchant's next step.
- "Doesn't look like I imagined" → acknowledge; theme is `Horizon`, editable via CLI/theme editor, more options after saving.
- Developers building apps/themes/extensions are a different topic (developer onboarding) — route once, don't ping-pong.

## Gotchas
- The storefront URL for a preview store is tokenized and short-lived; when it expires, re-run `shopify store open --store <domain>` (it fetches a fresh access URL).
- `store info` omits fields that aren't available for the store type; only preview stores return `accessUrl`/`saveUrl`/`authScopes`.
- `productCreate` (scope `write_products`) creates only the initial variant — use `productVariantsBulkCreate` for more; stores past 50,000 variants are throttled to 1,000 new variants/day.
- Publishing to an already-published publication succeeds as a no-op; `input` is an array, so publish to several channels in one call.
- Sample products created for a merchant must be `status: ACTIVE` **and** published to Online Store — draft or unpublished products look "missing" to them.
- `store list` ≠ `store auth list`: org membership vs local tokens. Preview stores won't appear in `store list` (no org).
- Developer testing is a different path: development stores (Dev Dashboard) can be seeded with Shopify-generated test data (snowboard catalog, Bogus payment gateway); such stores can't be transferred to merchants.

## Docs
https://shopify.dev/docs/api/shopify-cli/store
https://shopify.dev/docs/api/shopify-cli/store/store-create-preview
https://shopify.dev/docs/api/shopify-cli/store/store-info
https://shopify.dev/docs/api/shopify-cli/store/store-execute
https://shopify.dev/docs/api/shopify-cli
https://shopify.dev/docs/apps/build/sales-channels/product-publishing
https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate
https://shopify.dev/docs/api/development-stores/generated-test-data
