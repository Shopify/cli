# Customer Account API
GraphQL-only API for authenticated customers to read and manage their own data — orders, addresses, profile, returns, subscriptions, B2B, store credit — from headless storefronts, Hydrogen, and customer account UI extensions.

## Corrections to stale knowledge
- Current stable version: `2026-07`. Quarterly releases (`YYYY-MM`). Validate work with `shopify validate graphql --api customer` (add `--version 2026-07` to pin).
- Legacy customer accounts (Liquid pages) are deprecated (Feb 2026) and unavailable to new stores. Storefront API customer mutations (`customerCreate`, `customerAccessTokenCreate`, `customerRecover`, etc.) are legacy — build new customer flows on this API instead.
- `storefrontCustomerAccessTokenCreate` is deprecated. To keep the buyer authenticated into checkout: set `customerAccessToken` on the cart via Storefront `cartBuyerIdentityUpdate` and redirect to `checkoutUrl`, or append `sso=silent` to `checkoutUrl`.
- Never hardcode endpoints — discover them: `GET https://{shop-domain}/.well-known/customer-account-api` returns `graphql_api` (already versioned) and `mcp_api`; `GET /.well-known/openid-configuration` returns `authorization_endpoint`, `token_endpoint`, `end_session_endpoint`, `jwks_uri`. Versioned form: `https://{shop-domain}/customer/api/2026-07/graphql`.
- Auth is OAuth 2.0 authorization-code only (PKCE `S256` required for public clients; `Basic base64(client_id:client_secret)` header for confidential). There is no API-key header. Authorize scope string: `openid email customer-account-api:full`. API request header is `Authorization: {access_token}` — docs show no `Bearer` prefix. Refresh via `grant_type=refresh_token`.
- Client id/secret and permissions come from the Headless or Hydrogen sales channel settings, not Partner Dashboard app credentials. Redirect URIs must be `https` (mobile: `shop.{shop_id}.*` scheme); `localhost`/`http` are rejected — tunnel in dev.
- `Customer` has no `email`/`phone` scalars: use `emailAddress { emailAddress marketingState }` and `phoneNumber { phoneNumber marketingState }` (`Order.email` is a plain scalar).
- `CustomerUpdateInput` accepts ONLY `firstName`, `lastName`. Email, phone, and password changes are not exposed; marketing opt-in/out is `customerEmailMarketingSubscribe` / `customerEmailMarketingUnsubscribe` (no arguments).
- `CustomerAddressInput` uses `territoryCode` (country) + `zoneCode` (province/state) + `phoneNumber` — NOT `country`/`province`/`phone` (Storefront) nor `countryCode`/`provinceCode` (Admin).
- Apps using this API must meet protected customer data requirements (see Docs).

## Surface map (2026-07)
Root queries: `customer`, `order(id)`, `draftOrder(id)`, `return(id)`, `returnCalculate`, `shop`, `company`, `companyLocation(id)`.

| Mutation | Purpose |
|---|---|
| `customerUpdate(input)` | Update first/last name |
| `customerAddressCreate(address, defaultAddress)` | Add address, optionally set default |
| `customerAddressUpdate(addressId, address, defaultAddress)` | Edit address |
| `customerAddressDelete(addressId)` | Remove address |
| `customerEmailMarketingSubscribe` / `customerEmailMarketingUnsubscribe` | Toggle email marketing |
| `metafieldsSet(metafields)` / `metafieldsDelete` | Write/delete customer metafields |
| `orderRequestReturn(orderId, requestedLineItems)` | Self-serve return request |
| `subscriptionContractActivate/Pause/Cancel(subscriptionContractId)` | Manage subscription status |
| `subscriptionBillingCycleSkip/Unskip` | Skip a billing cycle |
| `subscriptionContractFetchDeliveryOptions` / `subscriptionContractSelectDeliveryMethod` | Change subscription delivery |
| `companyLocationAssignAddress` | B2B: update company location address |

Key `Customer` fields: `orders`, `addresses(skipDefault:)`, `defaultAddress`, `draftOrders`, `subscriptionContracts`, `storeCreditAccounts`, `companyContacts`, `metafield(namespace:, key:)`, `displayName`, `imageUrl`, `tags`, `creationDate`, `marketCurrencyCode`.
Key `Order` fields: `name`, `number`, `confirmationNumber`, `processedAt`, `financialStatus`, `fulfillmentStatus`, `statusPageUrl`, `totalPrice`, `lineItems`, `fulfillments`, `returns`, `refunds`, `transactions`, `shippingAddress`, `purchasingEntity`.

Enums (exact values):
- `OrderFinancialStatus`: `PENDING AUTHORIZED PARTIALLY_PAID PARTIALLY_REFUNDED VOIDED PAID REFUNDED EXPIRED`
- `OrderFulfillmentStatus`: `UNFULFILLED PARTIALLY_FULFILLED FULFILLED RESTOCKED PENDING_FULFILLMENT OPEN IN_PROGRESS ON_HOLD SCHEDULED`
- `Fulfillment.status` (`FulfillmentStatus`): `PENDING OPEN SUCCESS CANCELLED ERROR FAILURE`
- `ReturnStatus`: `REQUESTED OPEN CLOSED CANCELED DECLINED`
- `SubscriptionContractSubscriptionStatus`: `ACTIVE PAUSED CANCELLED EXPIRED FAILED STALE`
- `OrderSortKeys`: `CREATED_AT ID ORDER_NUMBER PROCESSED_AT TOTAL_PRICE UPDATED_AT`

Access scopes (apps request them in `shopify.app.toml`): `customer_read_customers`, `customer_write_customers`, `customer_read_orders`, `customer_read_draft_orders`, `customer_read_store_credit_accounts`, `customer_read_companies`, `customer_read_own_subscription_contracts`, `customer_write_own_subscription_contracts`.

## Examples (all pass `shopify validate graphql --api customer`)
Order history with tracking, cursor pagination:
```graphql
query OrderHistory($first: Int!, $after: String) {
  customer {
    orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name processedAt financialStatus fulfillmentStatus statusPageUrl
        totalPrice { amount currencyCode }
        fulfillments(first: 5) {
          nodes { latestShipmentStatus estimatedDeliveryAt trackingInformation { number url company } }
        }
      }
    }
  }
}
```
Create a default address (note `territoryCode`/`zoneCode`):
```graphql
mutation CreateAddress {
  customerAddressCreate(
    address: {firstName: "Jane", lastName: "Doe", address1: "150 Elgin Street", city: "Ottawa", territoryCode: "CA", zoneCode: "ON", zip: "K2P 1L4", phoneNumber: "+16135550123"}
    defaultAddress: true
  ) {
    customerAddress { id formatted }
    userErrors { code field message }
  }
}
```
Update profile and write an app-owned metafield:
```graphql
mutation PersonalizeAccount($customerId: ID!) {
  customerUpdate(input: {firstName: "Jane", lastName: "Doe"}) {
    customer { displayName }
    userErrors { code field message }
  }
  metafieldsSet(metafields: [{ownerId: $customerId, namespace: "$app", key: "nickname", value: "JD", type: "single_line_text_field"}]) {
    metafields { id key value }
    userErrors { field message }
  }
}
```
Request a return:
```graphql
mutation RequestReturn {
  orderRequestReturn(
    orderId: "gid://shopify/Order/1002"
    requestedLineItems: [{lineItemId: "gid://shopify/LineItem/3005", quantity: 1, customerNote: "Too small"}]
  ) {
    return { id name status }
    userErrors { code field message }
  }
}
```

## Auth flow (headless)
1. `GET /.well-known/openid-configuration` on the storefront domain.
2. Redirect to `authorization_endpoint` with `scope=openid email customer-account-api:full`, `client_id`, `response_type=code`, `redirect_uri`, `state`, `nonce`; public clients add `code_challenge` + `code_challenge_method=S256`. Optional: `locale`, `region_country`, `login_hint`, `prompt=none`.
3. `POST token_endpoint` with `grant_type=authorization_code`, `client_id`, `redirect_uri`, `code` (+ `code_verifier` public / `Authorization: Basic ...` confidential) → `{access_token, refresh_token, id_token, expires_in}`.
4. Logout: redirect to `end_session_endpoint?id_token_hint={id_token}&post_logout_redirect_uri=...`.
Hydrogen: don't hand-roll — use `createCustomerAccountClient` and `context.customerAccount.login()/.query()/.logout()`.
Token-endpoint errors: `400 invalid_grant` = base64url your challenge (strip `=`, `+`→`-`, `/`→`_`); `401 invalid_client` = wrong client_id; `401 invalid_token` = missing/unlisted `origin` header (JavaScript Origins setting); `403` = missing `user-agent` header.

## Gotchas
- Rate limit is calculated query cost: 7500-point bucket per app+store+customer, restored 100 pts/s (200 Advanced/Plus, 400 Enterprise). Fields ≈1 pt, mutations ≈10. Throttling returns HTTP 200 with `errors[0].extensions.code: "THROTTLED"`. `Shopify-GraphQL-Cost-Debug: 1` header gives a breakdown; cost is reported under `extensions.cost`.
- Cursor pagination only (`first`/`after`, `pageInfo { hasNextPage endCursor }`); connections expose both `nodes` and `edges`. Array inputs cap at 250 items.
- `orders(query:)` supports search syntax: `confirmation_number`, `id`, `name`, `order_number`, `processed_at`, `shipment_status`, plus B2B `purchasing_*` filters.
- Mutations return typed `userErrors { code field message }` — always request them; top-level HTTP is 200 even on failure.
- `@inContext(language:, country:, preferredLocationId:)` directive localizes responses and userErrors (language arg on versions after 2025-04) and drives `marketCurrencyCode`.
- Data is scoped to the authenticated customer; `customer` takes no id — no cross-customer lookup.
- Customer account UI extensions call this API directly (no token plumbing). Declare app metafields in `shopify.app.toml` as `[customer.metafields.app.<key>]` with `access.customer_account = "read_write"`, then write via `metafieldsSet` with `namespace: "$app"`. Extension components: see the components topic.

## Docs
https://shopify.dev/docs/api/customer/latest
https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started
https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/hydrogen
https://shopify.dev/docs/api/customer/latest/objects/Customer
https://shopify.dev/docs/api/customer/latest/objects/Order
https://shopify.dev/docs/apps/build/customer-accounts/metafields
https://shopify.dev/docs/api/usage/limits
