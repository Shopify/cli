# Hydrogen

Shopify's headless storefront stack: `@shopify/hydrogen` on React Router, deployed to Oxygen. Import from `@shopify/hydrogen` only (it re-exports `@shopify/hydrogen-react`). Components RENDER Storefront API data; fetch in loaders via `context.storefront.query`.

## Stale-training corrections

- Hydrogen versions pair with Storefront + Customer Account API versions quarterly (`2026.1.x` ↔ `2026-01`); docs/validator `latest` = **2026-04**. Framework is **React Router 7** (not Remix): import `useLoaderData`, `data`, `LoaderFunctionArgs` from `react-router`, NOT `@remix-run/react` (`@shopify/remix-oxygen` is only the Oxygen server adapter; server build: `virtual:react-router/server-build`).
- Scaffold: `npm create @shopify/hydrogen@latest`. The framework-agnostic developer preview (`npx @shopify/hydrogen@preview setup`) has different APIs — don't mix.
- `createHydrogenContext({env, request, cache, waitUntil, session, i18n, cart, customerAccount, storefront})` is the single setup call replacing hand-wired `createStorefrontClient`/`createCartHandler`/`createCustomerAccountClient`. Second arg merges extra context.
- Variant UI: `VariantSelector` is superseded by `getProductOptions` + `useOptimisticVariant` + `useSelectedOptionInUrlParam` (handles 2000-variant products, combined listings). Required query fields: see example below.
- Customer Account API (OAuth, `context.customerAccount.query`) is the default auth; Storefront `customerAccessTokenCreate` is the *legacy* flow. customerAccount never caches; storefront caches by default — customer-specific Storefront queries need `cache: storefront.CacheNone()` or you leak PII across users.
- Cart API: 2025-10 added `addGiftCardCodes`, `replaceDeliveryAddresses`; `updateDeliveryAddresses([])` now clears all. 2026-01: `cartDiscountCodesUpdate` requires `discountCodes`.
- `shopify_y`/`shopify_s` cookies die April 30 2026 — use `getTrackingValues()` (`uniqueToken` replaces `_y`, `visitToken` replaces `_s`).

## Surface map

| Export | Purpose |
|---|---|
| `Analytics.Provider` | Requires `cart`, `shop` (`getShopAnalytics`), `consent` `{checkoutDomain, storefrontAccessToken, withPrivacyBanner, country, language}`. `Analytics.ProductView/CollectionView/CartView/SearchView/CustomView` route events; `useAnalytics()` subscribe/publish |
| `CartForm` | Posts to cart route; `CartForm.ACTIONS.*`, `.getFormInput(formData)` |
| `Pagination` / `getPaginationVariables(request, {pageBy})` | Render prop `{nodes, NextLink, PreviousLink, isLoading, hasNextPage}` |
| `Image`, `Money`, `Video`, `ExternalVideo`, `MediaFile`, `ModelViewer`, `RichText` | Render Storefront objects; `Image` takes `data` + `sizes`/`aspectRatio`, crop `center\|top\|bottom\|left\|right` |
| `getSeoMeta` | Meta arrays in `meta` exports (title/description/jsonLd); preferred over `<Seo/>`. Sitemaps: `getSitemapIndex`/`getSitemap` |
| `createContentSecurityPolicy` / `useNonce` / `Script` | CSP in entry.server + nonce-carrying scripts |
| `createWithCache` | Third-party caching: `withCache.fetch(url, init, {cacheKey, cacheStrategy, shouldCacheResponse})`, `withCache.run` |
| `CacheNone/CacheShort/CacheLong/CacheCustom({mode,maxAge,staleWhileRevalidate,sMaxAge,staleIfError})` | Strategies for `storefront.query(q, {cache})` |
| `useOptimisticCart(cart)` | Instant cart UI; adds `isOptimistic` flags |
| `flattenConnection`, `parseGid`, `storefrontRedirect`, `getShopAnalytics` | Connection→array, gid parse, redirects, analytics shop payload |

Cart handler (`context.cart`) methods: `get getCartId setCartId create addLines updateLines removeLines updateDiscountCodes addGiftCardCodes updateGiftCardCodes removeGiftCardCodes updateBuyerIdentity updateNote updateAttributes setMetafields deleteMetafield updateSelectedDeliveryOption addDeliveryAddresses updateDeliveryAddresses replaceDeliveryAddresses removeDeliveryAddresses`; customize via `customMethods`/`cartQueryFragment`/`cartMutateFragment`.

## Examples

Cart route action + add-to-cart button:

```tsx
import {CartForm} from '@shopify/hydrogen';
import {data} from 'react-router';
import type {CartLineInput} from '@shopify/hydrogen/storefront-api-types';

export async function action({request, context}) {
  const {cart} = context;
  const {action, inputs} = CartForm.getFormInput(await request.formData());
  let result;
  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    default:
      throw new Error(`${action} cart action is not defined`);
  }
  // Cart id can change after mutations
  return data(result, {headers: cart.setCartId(result.cart.id)});
}

export function AddToCartButton({lines}: {lines: CartLineInput[]}) {
  return (
    <CartForm route="/cart" action={CartForm.ACTIONS.LinesAdd} inputs={{lines}}>
      <button type="submit">Add to cart</button>
    </CartForm>
  );
}
```

Paginated products route:

```tsx
import {getPaginationVariables, Pagination} from '@shopify/hydrogen';
import {useLoaderData} from 'react-router';

type ProductNode = {id: string; title: string; handle: string};

export async function loader({request, context}) {
  const {products} = await context.storefront.query(ALL_PRODUCTS_QUERY, {
    variables: getPaginationVariables(request, {pageBy: 8}),
    cache: context.storefront.CacheShort(),
  });
  return {products};
}

export default function Products() {
  const {products} = useLoaderData<typeof loader>();
  return (
    <Pagination<ProductNode> connection={products}>
      {({nodes, NextLink, PreviousLink, isLoading}) => (
        <>
          <PreviousLink>Previous</PreviousLink>
          {nodes.map((p) => (
            <a key={p.id} href={`/products/${p.handle}`}>{p.title}</a>
          ))}
          <NextLink>{isLoading ? 'Loading' : 'Next'}</NextLink>
        </>
      )}
    </Pagination>
  );
}

const ALL_PRODUCTS_QUERY = `#graphql
  query AllProducts($first: Int, $last: Int, $startCursor: String, $endCursor: String) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor) {
      nodes { id title handle }
      pageInfo { hasPreviousPage hasNextPage startCursor endCursor }
    }
  }
`;
```

Product query shaped for `getProductOptions`:

```graphql
query ProductForOptions($handle: String!, $selectedOptions: [SelectedOptionInput!]!) {
  product(handle: $handle) {
    id title handle
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant { ...V }
        swatch { color image { previewImage { url } } }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) { ...V }
    adjacentVariants(selectedOptions: $selectedOptions) { ...V }
  }
}
fragment V on ProductVariant {
  id availableForSale
  price { amount currencyCode }
  product { title handle }
  selectedOptions { name value }
}
```

Option values expose `{name, handle, variantUriQuery, selected, available, exists, isDifferentProduct, swatch}`; render `isDifferentProduct` (combined-listing child) as an anchor to `/products/{handle}?{variantUriQuery}`, others as buttons.

## Cookbook recipes

- **B2B**: session-stored `companyLocationId` → `buyerIdentity {companyLocationId, customerAccessToken}` on queries; render `quantityRule`/`quantityPriceBreaks`.
- **Bundles**: detect via variant `requiresComponents`; badge PDP/cart lines.
- **Combined listings**: native in `getProductOptions` (`isDifferentProduct`); filter parents by product `tags`.
- **Custom cart method**: `cart.customMethods`, e.g. `updateLineByOptions` (query `product.variantBySelectedOptions`, then `cartLinesUpdate`).
- **Markets**: locale from URL path/domain → `i18n: {language, country}`; Hydrogen auto-injects `$country`/`$language` for `@inContext`; country selector posts `CartForm.ACTIONS.BuyerIdentityUpdate`.
- **Subscriptions**: query `sellingPlanGroups`, add lines with `sellingPlanId`, show cart line `sellingPlanAllocation`.
- **Metaobjects**: metaobject queries as a lightweight CMS.
- **Infinite scroll**: `Pagination` + `react-intersection-observer` auto-clicking `NextLink`.
- **GTM/Partytown**: `<Script nonce>` + CSP entries; Partytown runs GTM in a web worker via a reverse-proxy route.
- **Express / self-host**: Node server instead of Oxygen; disable Customer Account API.
- **Third-party API**: build client with `createWithCache`, merge via `createHydrogenContext(opts, {clientName})`.

## Gotchas

- Oxygen runtime is `workerd`, not Node: no Node APIs, worker ≤10MB, 128MB memory, 30s CPU/request, ≤110 custom env vars. Deploy: `npx shopify hydrogen deploy`; `npx shopify hydrogen env pull` for local `.env`.
- Paginated queries must accept `$first $last $startCursor $endCursor` and return full `pageInfo` (see example) or `Pagination` breaks.
- Tag inline queries `#graphql` (typegen + validation depend on it).
- `withCache.fetch` skips caching on HTTP ≥400; in `withCache.run` you must throw to avoid caching failures.
- Commit the session when `session.isPending` and set `Set-Cookie` on the response.
- `PUBLIC_STOREFRONT_API_TOKEN` is client-safe; `PRIVATE_STOREFRONT_API_TOKEN` is a server delegate token. Hydrogen channel enables Oxygen; Headless channel for other hosts.

## Docs

https://shopify.dev/docs/api/hydrogen/latest
https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals
https://shopify.dev/docs/storefronts/headless/hydrogen/data-fetching
https://shopify.dev/docs/api/hydrogen/latest/utilities/cart/createcarthandler
https://shopify.dev/docs/api/hydrogen/latest/utilities/getproductoptions
https://shopify.dev/docs/storefronts/headless/hydrogen/cookbook
