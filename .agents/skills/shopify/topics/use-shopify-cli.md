# Shopify CLI operations
Running CLI workflows now: store-scoped Admin GraphQL reads/writes (`shopify store auth`/`execute`), app config validation on disk, the app/theme command trees, and command discovery.

## Corrections to stale training data
- The `shopify store` family (new in 2026; absent from older training data) runs Admin GraphQL directly from the terminal with no app project: `store auth`, `store auth list`, `store execute`, `store bulk execute|status|cancel`, `store graphiql`, `store info`, `store list`, `store open`, `store create preview`.
- `shopify app execute` / `app bulk execute|status|cancel` (CLI 3.90.1+, Feb 2026) run Admin GraphQL *as your app* (client-credentials grant, scopes from app config) from the app root; they default to the last-used dev store and allow mutations **only on dev stores**. `store execute` works on any store you ran `store auth` against but gates every mutation behind `--allow-mutations`.
- Latest stable API version: `2026-07` (quarterly `YYYY-MM` releases, each supported >=12 months). Execute commands take `--version`; default is latest stable.
- `productByHandle` is deprecated — use `productByIdentifier(identifier: {handle: "..."})`.
- Bulk operations: API `2026-01`+ allows five concurrent bulk ops of each type (query/mutation) per shop; earlier versions allow one of each.
- CLI 4.x (May 2026) uses SemVer and auto-upgrades via your package manager (skipped in CI, project-local installs, major bumps). `shopify upgrade` runs it now; `shopify config autoupgrade on|off|status` controls it.
- Removed in CLI 4.0: `app deploy|release --force` (use `--allow-updates` / `--allow-deletes`), `shopify webhook trigger` (→ `app webhook trigger`), `theme serve` (→ `theme dev`), `app generate schema` (→ `app function schema`), `app generate extension --type` (→ `--template`).
- Nearly every flag has a `SHOPIFY_FLAG_*` env form (shown in `--help`, e.g. `SHOPIFY_FLAG_STORE`) — set those in CI instead of flags.
- Install `npm install -g @shopify/cli@latest` (Node 22.12+, Git 2.28+). `@shopify/app` is bundled — never install it separately.

## Command discovery — never guess names or flags
```sh
shopify commands --tree    # nested list of every command (--json machine-readable)
shopify app --help         # a topic's subcommands
shopify theme push --help  # one command's flags + env vars
shopify doc search --query "app configuration" --api-name admin  # shopify.dev vector search, JSON chunks
shopify doc fetch --url https://shopify.dev/docs/api/shopify-cli --output page.md  # full page as Markdown
```

## Command map
| Topic | Commands |
| - | - |
| `app` | `init`, `dev`, `dev clean`, `deploy`, `release`, `build`, `generate extension`, `config link\|pull\|use\|validate`, `env pull\|show`, `execute`, `bulk execute\|status\|cancel`, `function build\|run\|replay\|schema\|typegen\|info`, `graphiql`, `import-extensions`, `import-custom-data-definitions`, `info`, `logs`, `versions list`, `webhook trigger` |
| `store` | `auth`, `auth list`, `execute`, `bulk execute\|status\|cancel`, `graphiql`, `info`, `list`, `open`, `create preview` |
| `theme` | `init`, `dev`, `pull`, `push`, `publish`, `list`, `check`, `console`, `share`, `preview`, `package`, `delete`, `duplicate`, `info`, `metafields pull`, `open`, `rename`, `profile` |
| `hydrogen` | `init`, `dev`, `build`, `deploy`, `link`, `env list\|pull\|push`, `generate route\|routes`, `codegen`, `check`, `upgrade`, `preview` |
| general | `auth login\|logout`, `organization list`, `commands`, `search`, `doc search\|fetch`, `upgrade`, `version`, `config autoupgrade\|autocorrect on\|off\|status` |

## Store workflow: auth once, then execute
`store auth` stores an online access token for the store (re-run when it expires or you need more scopes); both flags are required. Request the narrowest scopes the operation needs (`read_products`, `write_inventory`, ...).
```sh
shopify store auth --store shop.myshopify.com --scopes read_products,write_inventory
shopify store execute --store shop.myshopify.com --json \
  --query 'query { products(first: 10) { edges { node { id title handle } } } }'
```
Mutation (requires `--allow-mutations`; adjust available stock by delta):
```sh
shopify store execute --store shop.myshopify.com --allow-mutations \
  --query 'mutation adjust($input: InventoryAdjustQuantitiesInput!) { inventoryAdjustQuantities(input: $input) { inventoryAdjustmentGroup { reason changes { name delta } } userErrors { field message } } }' \
  --variables '{"input":{"reason":"correction","name":"available","referenceDocumentUri":"logistics://warehouse/recount/2026-07","changes":[{"delta":-4,"inventoryItemId":"gid://shopify/InventoryItem/30322695","locationId":"gid://shopify/Location/124656943"}]}}'
```
Bulk (async JSONL export; `--watch` polls to completion):
```sh
shopify store bulk execute --store shop.myshopify.com --watch \
  --query 'query { products { edges { node { id title variants { edges { node { id sku } } } } } } }'
```
Other flags: `--query-file` (exclusive with `--query`), `--variable-file` (exclusive with `--variables`), `--output-file`, `--version 2026-07`. `store graphiql --store shop.myshopify.com --port 9123` opens a local GraphiQL against the stored auth.

## Store lookups: handle, SKU, location
| Need | Operation |
| - | - |
| Product by handle | `productByIdentifier(identifier: {handle: "slate-snowboard"}) { id title }` |
| Variant + inventory item by SKU | `productVariants(first: 10, query: "sku:SLATE-001") { edges { node { id sku inventoryItem { id } } } }` (wildcards: `sku:element*`) |
| Location by name | `locations(first: 5, query: "name:Warehouse") { edges { node { id name } } }` (active only by default; `includeInactive: true` for all) |
| Set absolute quantity | `inventorySetQuantities` — compare-and-set: pass `compareQuantity` per change or `ignoreCompareQuantity: true`; quantity `name` is `available` or `on_hand` |
| Update variant price | `productVariantsBulkUpdate(productId:, variants: [{id:, price:}])` — despite the name, it's the standard single-product variant update |

## App config validation
```sh
shopify app config validate --json                   # validates shopify.app.toml + every extension config
shopify app config validate --config staging --json  # validates shopify.app.staging.toml
```
Validates the selected app configuration file and all `shopify.extension.toml` files against their schemas. Run from the app root or pass `--path <dir>`; `--client-id` overrides the app. This — not GraphQL validation and not field-by-field doc comparison — is the answer to "is my config valid". Config edits apply live to your dev store during `app dev`; `shopify app deploy` releases config + extensions to all stores as one app version.

## Theme operations
```sh
shopify theme dev --store shop.myshopify.com  # http://127.0.0.1:9292, hot reload
shopify theme pull --live                     # or -d/--development
shopify theme push --allow-live               # pushing to the live theme requires -a/--allow-live
```
Selection flags: `--theme <id|name>`, `--live`, `--development`, `--unpublished`; scope with `--only`/`--ignore`, keep remote-only files with `--nodelete`; `push`/`list`/`info` take `--json`. Non-interactive auth: Theme Access app password (`shptka_...`) via `--password` or `SHOPIFY_CLI_THEME_TOKEN` + `SHOPIFY_FLAG_STORE` env vars; a custom-app token needs `read_themes,write_themes` scopes. Per-project defaults live in `shopify.theme.toml` (any theme flag except `environment`, `path`, `verbose`):
```toml
[environments.production]
store = "shop.myshopify.com"
password = "shptka_123456"

[environments.staging]
store = "staging-shop.myshopify.com"
theme = "123456789012"
ignore = ["config/settings_data.json"]
```
Use `--environment production` per command; `[environments.default]` applies when the flag is omitted.

## Gotchas
- Run the exact command the docs name: `shopify store execute` (not `store run`/`store query`), `shopify app config validate` (not `shopify validate` — that command's topics are `theme|graphql|functions|components` and don't cover TOML config).
- `store execute` fails without prior `store auth` for that store; `store auth list` shows which stores have stored tokens. Missing-scope errors mean re-run `store auth` with more scopes.
- Bulk queries must select connection fields; `first` is ignored, results arrive as JSONL where children follow parents linked by `__parentId`. Run the query via plain `store execute` first — error feedback inside bulk operations is poor.
- Plain connection pagination caps at 250 nodes per page (cursor via `pageInfo { hasNextPage endCursor }`); Admin GraphQL is rate-limited by calculated query cost (100 points/s standard plan). Use bulk for large exports.
- `app dev` creates a persistent dev preview on the store (no drafts); clean it with `shopify app dev clean`.
- Development themes are temporary: deleted after 7 days of inactivity or on `shopify auth logout`. `theme push --unpublished` keeps a durable copy.
- Named store data (a handle, SKU, or location name) is not an id — resolve it with the lookup queries above inside the same CLI flow before mutating; mutations on real stores are guarded by `--allow-mutations` for a reason.

## Docs
https://shopify.dev/docs/api/shopify-cli
https://shopify.dev/docs/api/shopify-cli/store/store-execute
https://shopify.dev/docs/api/shopify-cli/store/store-auth
https://shopify.dev/docs/api/usage/api-exploration/admin-cli-app-execute
https://shopify.dev/docs/api/shopify-cli/app/app-config-validate
https://shopify.dev/docs/api/usage/bulk-operations/queries
https://shopify.dev/docs/storefronts/themes/tools/cli/environments
https://shopify.dev/docs/api/usage/versioning
