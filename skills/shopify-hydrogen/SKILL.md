---
name: shopify-hydrogen
description: "Prevents agents from generating Next.js patterns when building Shopify Hydrogen storefronts — covers routing, data loading, cart, auth, caching, and deployment."
metadata:
  author: shopify
  version: "1.0"
---

# Shopify Hydrogen — Agent Skill

> The Hydrogen CLI lives in `github.com/Shopify/hydrogen`, NOT this CLI repo.

## Critical Mental Model

Hydrogen is **NOT Next.js**. It is built on **React Router** (formerly Remix). Do not generate:
- `getServerSideProps`, `getStaticProps`, `useRouter` from `next/router`
- `app/` directory with `page.tsx` / `layout.tsx` (Next.js App Router)
- `next/image`, `next/link`, `next/head`

Instead use React Router conventions throughout.

## Routing (React Router, NOT Next.js)

- File-based routing via `@react-router/fs-routes` + `hydrogenRoutes` wrapper
- Route config in `app/routes.ts`:
  ```ts
  import {flatRoutes} from '@react-router/fs-routes';
  import {hydrogenRoutes} from '@shopify/hydrogen';
  export default (async () => hydrogenRoutes([...(await flatRoutes())]))() satisfies Promise<RouteConfig>;
  ```
- Route files export `loader`, `action`, `meta`, `headers`, and a default component
- Types: `Route.LoaderArgs`, `Route.ActionArgs`, `Route.MetaFunction` (from `./+types/<route>`)
- Data hooks: `useLoaderData`, `useActionData`, `Form` — all from `'react-router'`
- Redirects: `redirect()` from `'react-router'`, not `next/navigation`
- Return data with `data()` from `'react-router'` (not `json()`)

## Storefront API (NOT Admin API)

- Hydrogen uses the **Storefront API** — a public-facing, rate-limited GraphQL API
- Client available as `context.storefront` in loaders/actions
- Query: `storefront.query(GRAPHQL_STRING, {variables, cache})`
- Mutate: `storefront.mutate(GRAPHQL_STRING, {variables})`
- Auth via public token (`PUBLIC_STOREFRONT_API_TOKEN`) — no admin scopes
- Inline GraphQL strings prefixed with `#graphql` for syntax highlighting
- Required env vars: `PUBLIC_STOREFRONT_API_TOKEN`, `PUBLIC_STORE_DOMAIN`, `PUBLIC_STOREFRONT_ID`

## Cart API

Cart is NOT standard REST. Hydrogen provides `CartForm` and a cart context object:
- `context.cart` exposes: `addLines`, `updateLines`, `removeLines`, `updateDiscountCodes`, `updateGiftCardCodes`, `updateBuyerIdentity`, `get`, `setCartId`
- Actions parse form data via `CartForm.getFormInput(formData)`
- Action types: `CartForm.ACTIONS.LinesAdd`, `.LinesUpdate`, `.LinesRemove`, `.DiscountCodesUpdate`, `.GiftCardCodesUpdate`, `.BuyerIdentityUpdate`
- Cart result shape: `{cart, errors, warnings}`

## Customer Authentication

- Uses **Customer Account API** — separate from Admin API auth
- Env vars: `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, `PUBLIC_CUSTOMER_ACCOUNT_API_URL`
- Session-based: `context.session.get('customerAccessToken')`
- Redirect unauthenticated users to `/account/login`
- Customer mutations use Storefront API `customerUpdate` mutation with access token

## Caching (Shopify-Specific)

Hydrogen has built-in cache strategies — do NOT implement manual cache headers:
| Strategy | max-age | SWR | Use case |
|---|---|---|---|
| `CacheShort()` | 1s | 9s | Dynamic data (cart, search) |
| `CacheLong()` | 1h | 23h | Stable data (products, collections) |
| `CacheNone()` | no-store | — | Customer-specific data |
| `CacheCustom({mode, maxAge, staleWhileRevalidate, staleIfError})` | custom | custom | Fine-grained control |

Pass as `cache` option: `storefront.query(QUERY, {variables, cache: CacheLong()})`

## Oxygen Hosting

- Oxygen is Shopify's edge hosting platform for Hydrogen
- Deploy: `npx shopify hydrogen deploy`
- Cache API: `await caches.open('hydrogen')` (Web Cache API, not Node)
- Context created via `createHydrogenContext({env, session, cart})`
- Worker-based runtime — no Node.js `fs`, `path`, or `process.env` (use `env` param)

## Documentation

- Primary: https://shopify.dev/docs/storefronts/headless/hydrogen
- Hydrogen repo: https://github.com/Shopify/hydrogen
- Storefront API reference: https://shopify.dev/docs/api/storefront
