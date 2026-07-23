# Universal Commerce Protocol (UCP)
Agentic commerce on Shopify: cross-merchant catalog search, carts, checkout, and order tracking via UCP-compliant MCP servers (JSON-RPC 2.0) and the `ucp` CLI.

## Corrections to stale training data
- Open protocol (ucp.dev). Live versions on Shopify: `2026-04-08` (current) and `2026-01-23`, negotiated per session from your agent profile.
- Legacy Storefront MCP at `https://{shop}.myshopify.com/api/mcp` is deprecated: search/lookup tools removed 2026-06-15, cart tools (`get_cart`, `update_cart`) kept until 2026-08-31.
- Endpoints: Global Catalog `https://catalog.shopify.com/api/ucp/mcp`; merchant-scoped (storefront catalog, cart, checkout, order) `https://{shop-domain}/api/ucp/mcp`. Shop business profile: `https://{shop}.myshopify.com/.well-known/ucp`.
- Every `tools/call` must send `arguments.meta["ucp-agent"].profile` = HTTPS URL of your hosted platform-profile JSON. Negotiation is server-selects: Shopify intersects your declared capabilities with the shop's and prunes orphaned extensions.
- `meta["idempotency-key"]` (UUID) is required on `cancel_cart`, `complete_checkout`, `cancel_checkout`.
- `update_cart`/`update_checkout` are PUT: the payload replaces full state, omitted fields are deleted (unlike Storefront API/AJAX patching) — always resend the whole `line_items` array.
- Money = signed integer minor units with paired ISO 4217 `currency` (`8900` = $89.00); negative rows are discounts/refunds. Render `totals[]` rows in order; on orders `display_text` just mirrors `type`.
- Auth tiers: **Token** (Dev Dashboard `client_id`/`client_secret` → `POST https://api.shopify.com/auth/access_token`, `grant_type=client_credentials`, 60-min JWT), **Signed** (RFC 9421 HTTP Message Signatures, ECDSA P-256, key in profile), **Anonymous**. Catalog, cart, and checkout build/edit tools work unauthenticated; `complete_checkout` needs Token + purchase permission; `get_order` needs the `read_global_api_orders` scope.
- Errors: transport failures are JSON-RPC `error` code `-32000` (`-32001` discovery); honor `Retry-After`, then backoff + jitter. Business outcomes are successful `result` with `messages[]` (`type`, `code`, `severity`, JSONPath `path`) — check before reading fields. Payload is in `result.structuredContent` (cart nested under `.cart`; checkout/order/catalog at top level).

## Surface map
| Tool | Capability | Purpose |
|---|---|---|
| `search_catalog` | `dev.ucp.shopping.catalog.search` | Text/image/similarity search; global (UPID-clustered) or per-store |
| `lookup_catalog` | `dev.ucp.shopping.catalog.lookup` | Resolve GIDs/product URLs to fresh data (≤50 ids global, ≤10 storefront); misses → `not_found` in `messages` |
| `get_product` | `dev.ucp.shopping.catalog.lookup` | Full `options[]` matrix; `selected:[{name,label}]` narrows variants, `preferences` sets relaxation order |
| `create_cart` `get_cart` `update_cart` `cancel_cart` | `dev.ucp.shopping.cart` | Pre-checkout container: long TTL, unauthenticated, iterate + estimate totals |
| `create_checkout` `get_checkout` `update_checkout` `complete_checkout` `cancel_checkout` | `dev.ucp.shopping.checkout` | Purchase session: short-lived (`expires_at`), stricter rate limits |
| `get_order` | `dev.ucp.shopping.order` | Current order state; only orders placed through your agent |

Extensions: `dev.ucp.shopping.fulfillment|discount|buyer_consent` extend checkout/cart (undeclared ⇒ tool schemas omit those fields). `dev.shopify.catalog` (storefront: `gift_card`, `collections`, `selling_plans`), `dev.shopify.catalog.global` (`checkout_url`, `requires.shipping|components`, `eligible.native_checkout`, `availability.running_low`, ML `metadata.*`). Shop Pay handler `dev.shopify.shop_pay`: instrument `type:"shop_pay"`, credential `type:"shop_token"`.

## UCP CLI (`npm install -g @shopify/ucp-cli`)
`ucp profile init --name agent` (writes `~/.ucp/profiles/agent.yaml`); `ucp doctor` checks health. Flags: `--business <url>` = merchant scope (omit for global catalog); `--set /json/pointer=value`; `--input '<json>'`; `--input-schema` fetches the merchant's live schema; `--view :compact` or JMESPath; `--format md|json`. Full flow:
```bash
ucp profile init --name agent
ucp catalog search --set /query='wireless headphones under $100' \
  --set /context/address_country=US --view :compact
ucp cart create --business https://shop.example.com \
  --set /line_items/0/item/id='gid://shopify/ProductVariant/41293818167385' \
  --set /line_items/0/quantity=1 --set /context/address_country=US
ucp checkout create --business https://shop.example.com \
  --input '{"cart_id":"gid://shopify/Cart/abc123"}'
export UCP_ON_ESCALATION='jq -r .url | xargs open'  # auto-open handoff
ucp checkout complete gid://shopify/Checkout/def456 --business https://shop.example.com
ucp order get gid://shopify/Order/789 --business https://shop.example.com
```

## Minimal agent profile (host at a public URL)
```json
{"ucp": {"version": "2026-04-08", "capabilities": {
  "dev.ucp.shopping.cart": [{"version": "2026-04-08"}],
  "dev.ucp.shopping.checkout": [{"version": "2026-04-08"}]}}}
```
Cart→checkout conversion requires both capabilities declared.

## Direct MCP call — `create_cart`
```json
{"jsonrpc": "2.0", "method": "tools/call", "id": 1, "params": {"name": "create_cart", "arguments": {
  "meta": {"ucp-agent": {"profile": "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json"}},
  "cart": {"line_items": [{"quantity": 2, "item": {"id": "gid://shopify/ProductVariant/12345678901"}}],
           "context": {"address_country": "US"}}}}}
```
`context` is a localization/pricing hint only (geo-IP fallback) — never the shipping address; collect that via checkout `fulfillment.methods[].destinations[]` (`first_name last_name street_address address_locality address_region postal_code address_country`).

## Checkout lifecycle
| `status` | Action |
|---|---|
| `incomplete` | Fix `recoverable` messages via `update_checkout` |
| `requires_escalation` | `requires_buyer_input`/`requires_buyer_review` severity → hand buyer to `continue_url` |
| `ready_for_complete` | Call `complete_checkout` (or still hand off) |
| `complete_in_progress` | Merchant processing |
| `completed` | Done; response carries `order.id` + `order.permalink_url` |
| `canceled` | Session invalid/expired; start over |

General access always ends at `requires_escalation`: handoff via `continue_url` IS completion; `complete_checkout` is never called. Cart→checkout: pass top-level `cart_id` to `create_checkout`; cart contents win over overlapping `checkout` fields; conversion is idempotent (returns the existing incomplete session); `cart_id` is not echoed back — store it. Failures: `invalid_cart_id`, `cart_not_found`.

## Catalog specifics
- IDs: products `gid://shopify/p/{upid}` (UPID cluster), variants `gid://shopify/ProductVariant/{id}`, shops `gid://shopify/Shop/{id}`. Pass variant ids verbatim into carts; `seller.domain` is the merchant identity (brand in `title` ≠ seller).
- `search_catalog` filters: `available` (default `true`), `condition` `["new","secondhand"]`, `ships_to {country,region,postal_code}`, `ships_from [{country}]`, `price {min,max}` minor units, `shops` (≤1000 GIDs), `attributes` (only `Color`, `Size`, `Target gender`), `rating {variant:{min,min_count}}`, `price_tier` `["low","medium","high"]`, `categories`. `like` takes a GID or `{image:{content_type,data}}` base64 for visual/multimodal search.
- Pagination: opaque `cursor` + `limit` (default 10; max 50 global, 250 storefront); depth capped at 1,000 results; `total_count` is an estimate.
- Each variant's `checkout_url` is a cart permalink (`https://{domain}/cart/{variantId}:{qty}`); one merchant per URL.

## Orders
- Webhooks are the primary channel (topics `orders/create|updated|delete`; every delivery = full current state, identical shape to `get_order` — don't replay/merge, don't branch on topic). Subscriptions are provisioned by Shopify (no self-serve API). Verify `X-Shopify-Hmac-SHA256` = base64 HMAC-SHA256 of raw body with your `client_secret`; dedupe on `X-Shopify-Webhook-Id`; 8 retries over 4h.
- `get_order`: wait ~10 s after `complete_checkout` (propagation). Errors set `result.isError:true` with `invalid_order_id` (recoverable), `order_not_found`, `orders_not_allowed` (unrecoverable).
- `line_items[].quantity` = `{original,total,fulfilled}`; removed lines stay with `status:"removed"`. `adjustments[].type`: `refund|cancellation|return|exchange|order_edit|sale_transaction|capture_transaction|refund_transaction` (`2026-01-23`: `order_cancel` replaces `cancellation`). Fulfillment `events[].type` incl. `shipped|in_transit|out_for_delivery|delivered|ready_for_pickup|delayed|buyer_action_required` (`2026-01-23`: `fulfillment_created` replaces `shipped`/`ready`) — open enums. Missing `tax` row ⇒ tax-inclusive prices.

## Gotchas
- Buyer names a merchant? `ucp discover --business <url>` first — `PROFILE_FETCH_FAILED` = no UCP support; on `AUTH_REQUIRED`/`INSUFFICIENT_PERMISSIONS`/`OPERATION_NOT_OFFERED` stop retrying and hand off via `continue_url`, else variant `checkout_url`, else PDP/seller URL.
- Buyer-linked tokens (Shop customer identity): RFC 8693 token exchange at `accounts.shop.app` (`audience=api.shopify.com`), then redeem at `api.shopify.com/auth/access_token` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`. Server-side only.
- Embedded Checkout Protocol (ECP): load `continue_url` + `ec_version=2026-01-23`, `ec_auth`, `ec_delegate=fulfillment.address_change,payment.instruments_change,payment.credential` in a web view; Checkout Kit SDK wraps it.

## Docs
https://shopify.dev/docs/agents
https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting
https://shopify.dev/docs/agents/catalog/global-catalog
https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp
https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp
https://shopify.dev/docs/agents/orders/order-mcp
