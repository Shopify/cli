# Developer onboarding
Getting started building on Shopify: CLI install, developer accounts, dev stores, and scaffolding apps, themes, and Hydrogen storefronts.

## Corrections to stale training data
- Latest stable API version: `2026-07`. Quarterly date-based versions (`2026-04`, `2026-10`, ...), each supported >=12 months. Requests to a retired version silently fall forward to the oldest accessible stable version; check the `X-Shopify-API-Version` response header.
- The Partner Dashboard is replaced by the **Dev Dashboard** (`https://dev.shopify.com/dashboard/`) for all app-dev workflows (GA Sept 2025; requires CLI >=3.84.1). Apps, dev stores, client transfer stores, collaborations, monitoring/logs, and credentials all live there. `--organization-id` appears in its URL.
- Dashboard-managed extensions no longer exist: extensions are created and managed only via Shopify CLI, and every extension needs a `uid` in its `shopify.extension.toml` (auto-added by `shopify app generate extension` and interactive `shopify app deploy`; `deploy --force` and `app dev` fail without it).
- `shopify app config push` and `include_config_on_deploy` are removed. `shopify app deploy` always releases app config + extensions together as an app version.
- Recommended app template: **React Router** (`--template reactRouter`, package `@shopify/shopify-app-react-router`); it supersedes the Remix template. Web files live at the project root, not `web/`.
- `shopify theme init` clones the **Skeleton theme** (`https://github.com/Shopify/skeleton-theme.git`) by default — not Dawn.
- Shopify CLI 4.x auto-upgrades itself via your package manager (skipped in CI, project-local installs, major bumps); manage with `shopify upgrade`, `shopify config autoupgrade on|off|status`. `@shopify/app` is bundled since CLI 3.59.0 — never install it separately.
- Dev stores can be created on any plan: `Basic`, `Grow`, `Advanced`, `Plus`.
- Private apps (deprecated 2022, auto-converted to custom apps 2023) and unpublished apps can no longer be created. Distribution methods: **Public** (Shopify App Store, review required) or **Custom** (one store, multiple stores in the same Plus org, or transfer-disabled dev stores; no Billing API). Selected once in the dashboard — irreversible.
- `shopify app dev` no longer uses drafts: it creates a **dev preview** on the store without releasing a version. The preview persists after you stop dev — clean it with `shopify app dev clean` or the Dev Console in admin.

## Requirements and install
Node.js 22.12+, a package manager (npm, Yarn 1.x, or pnpm), Git 2.28.0+.
```sh
npm install -g @shopify/cli@latest
```
macOS alternative: `brew tap shopify/shopify && brew install shopify-cli`. Global install is recommended; use a local `npm install -D @shopify/cli` only to pin one version per team/app (then invoke as `npm run shopify ...`).
Developer account: sign in at `https://dev.shopify.com/dashboard/`; create dev stores under Stores > Create store (optionally enable a feature preview — those stores lose domains access).
Auth: `shopify auth login` / `shopify auth logout` (logout deletes your development themes). Analytics opt-out: `SHOPIFY_CLI_NO_ANALYTICS=1`. Proxy: `SHOPIFY_HTTP_PROXY` (CLI 3.78+).

## What to build -> path
| Goal | Path |
| - | - |
| Embedded admin app | `shopify app init` with `--template reactRouter` |
| Extension-only app (no server) | `shopify app init --template none` |
| API-only integration for your own store | Create the app in the Dev Dashboard; client credentials grant (tokens expire after 24 h) |
| Theme | `shopify theme init` (Skeleton theme) |
| Headless storefront | Hydrogen (React Router based), Hydrogen React components, or raw Storefront API |

## Command surface
| Group | Key commands |
| - | - |
| General | `auth login`, `auth logout`, `organization list`, `search`, `upgrade`, `version`, `config autoupgrade on\|off\|status` |
| `app` | `init`, `dev`, `dev clean`, `deploy`, `release`, `generate extension`, `config link\|use\|validate`, `env pull\|show`, `info`, `logs`, `versions list`, `webhook trigger`, `import-extensions`, `function run\|replay\|schema\|typegen`, `graphiql` |
| `theme` | `init`, `dev`, `pull`, `push`, `publish`, `list`, `check`, `console`, `share`, `preview`, `package`, `delete`, `duplicate`, `info`, `metafields pull`, `open`, `rename`, `profile` |
| `store` | `auth`, `execute` (Admin GraphQL), `graphiql`, `info`, `list`, `open`, `bulk execute\|status\|cancel` |
| `hydrogen` | `init`, `dev`, `build`, `deploy`, `link`, `env pull\|push`, `generate route`, `codegen`, `upgrade` |

## Examples
App — first `dev` logs you in, creates the app record in the Dev Dashboard, and connects your code; the store must be an existing dev store you own or have staff access to:
```sh
shopify app init --name inventory-sync --template reactRouter --package-manager npm
cd inventory-sync
shopify app dev --store my-dev-store.myshopify.com
```
Press `p` to open the install/preview URL. `app dev` builds, tunnels (Cloudflare Quick Tunnel), watches files, and applies `shopify.app.toml` changes to the dev store automatically.

Theme:
```sh
shopify theme init my-new-theme
cd my-new-theme
shopify theme dev --store my-store
shopify theme push --unpublished
shopify theme publish
```
`theme dev` uploads a development theme and serves `http://127.0.0.1:9292` (hot reload works in Google Chrome only). `--store` is remembered for later commands; `shopify theme info` shows the current one.

Hydrogen — quickstart uses Mock.shop demo data; connect a real store later with `shopify hydrogen link`:
```sh
npm create @shopify/hydrogen@latest -- --quickstart
cd hydrogen-quickstart
shopify hydrogen dev
```
Serves `http://localhost:3000`.

## shopify.app.toml (root of every CLI app)
```toml
name = "inventory-sync"
client_id = "a61950a2cbd5f32876b0b55587ec7a27"
application_url = "https://inventory-sync.example.com/"
embedded = true

[access_scopes]
scopes = "read_products,write_products"

[auth]
redirect_urls = ["https://inventory-sync.example.com/api/auth/callback"]

[webhooks]
api_version = "2026-07"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
compliance_topics = ["customers/redact", "customers/data_request", "shop/redact"]
uri = "/webhooks"

[build]
automatically_update_urls_on_dev = true
dev_store_url = "my-dev-store.myshopify.com"
```
Required keys: `name`, `client_id`, `application_url`, `embedded`, `[access_scopes] scopes`, `[auth] redirect_urls`, `[webhooks] api_version`. `handle` is optional and changing it breaks admin links. Other tables: `[access.admin]` (`direct_api_mode = "online"|"offline"`, `embedded_app_direct_api_access`), `[customer_authentication]`, `[[events.subscription]]`, `[app_proxy]` (`prefix` must be `a|apps|community|tools`; `subpath` <=30 chars), `[pos]`, `[app_preferences]`. `shopify.app.{config}.toml` variants link one codebase to several apps (`shopify app config link`, `app config use`). Extensions live in `extensions/<handle>/shopify.extension.toml` (override with `extension_directories`).
Config edits apply live during `app dev` to your dev store only; run `shopify app deploy` to release them to all stores.

## Gotchas
- Using a dev store with the CLI requires being the store owner or a staff member. Dev stores install only free/partner-friendly apps, can't process real payments (Bogus gateway or payment-provider test mode only), can't remove the storefront password page, and can't be transferred to clients — use client transfer stores. Stores created with generated test data (snowboard catalog, Bogus gateway preconfigured) can never be transferred.
- Development themes are temporary and hidden, don't count toward theme limits, and are deleted after 7 days of inactivity or on `shopify auth logout`. Push to an unpublished theme to keep a durable copy.
- `app dev --use-localhost` (CLI 3.80+) skips the tunnel using a mkcert self-signed cert (reverse proxy on port 3458; override with `--localhost-port`) but breaks anything Shopify must call directly: webhooks, app proxy, Flow actions, POS. `--tunnel-url` uses your own tunnel (e.g. ngrok).
- Theme commands on stores you can't log in to: pass `--password` with a Theme Access app password; custom-app tokens need the `read_themes`,`write_themes` scopes.
- The CLI injects env vars into app processes: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `HOST`/`APP_URL`, `PORT`, `SCOPES`, `BACKEND_PORT`/`FRONTEND_PORT`. Process roles come from `shopify.web.toml` (`roles = ["frontend"|"backend"|"background"]`, `commands.dev` required; `type` is deprecated).
- Versioned APIs: Admin, Storefront, Customer Account, Functions, Partner, Payments Apps, webhook payloads. Unversioned (can change anytime): Liquid, Ajax, App Home, OAuth/`AccessScope`, Web Pixels. The CLI blocks deploys targeting UI-extension versions older than 12 months.
- `shopify app init --template` accepts only `reactRouter`, `none`, or a GitHub repo URL (optional branch and subpath).

## Docs
https://shopify.dev/docs/api/shopify-cli
https://shopify.dev/docs/apps/build/scaffold-app
https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration
https://shopify.dev/docs/apps/build/dev-dashboard
https://shopify.dev/docs/apps/build/dev-dashboard/stores/development-stores
https://shopify.dev/docs/storefronts/themes/getting-started/create
https://shopify.dev/docs/storefronts/headless/hydrogen/getting-started
https://shopify.dev/docs/api/usage/versioning
