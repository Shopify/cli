# Partner API
GraphQL API over Partner Dashboard data: earnings transactions, app install/charge events, app credits, and (2026-07+) managed-pricing subscriptions. Read-heavy; not the Admin API.

## Facts that override stale training data
- Endpoint: `POST https://partners.shopify.com/{organization_id}/api/{version}/graphql.json`. Auth header `X-Shopify-Access-Token: <partner-token>`. Tokens are Partner API client tokens created in Partner Dashboard → Settings → Partner API clients (org owners only) — never merchant/Admin tokens or OAuth.
- Versions are quarterly `YYYY-MM`. Latest stable: `2026-07`, which adds `events`, `activeSubscription`, `appSubscriptionCancel`. List versions via `publicApiVersions { handle supported }`.
- `PageInfo` has ONLY `hasNextPage`/`hasPreviousPage` — no `endCursor`/`startCursor`. Paginate by selecting `edges { cursor }` and passing the last cursor to `after`. Exception: the 2026-07 `events` connection's `pageInfo` does have `startCursor`/`endCursor`.
- Root queries are only `app(id:)`, `transaction(id:)`, `transactions(...)`, `publicApiVersions` (+ `events`, `activeSubscription` in 2026-07). There is no `apps`, `shop`, or `organization` root — you cannot list your apps; you must already know the GID.
- Stable mutations: `appCreditCreate`; 2026-07 adds `appSubscriptionCancel`. `eventsinkCreate`/`eventsinkDelete` are `unstable`-only. Experts Marketplace surfaces (`conversations`, `jobs`, `Conversation`, `Job`) from older docs fail schema validation on every current version incl. `unstable` — don't generate them.
- GID namespace is `gid://partners/...` (`gid://partners/App/1234`, `gid://partners/Shop/1234`, `gid://partners/ThemeSale/1234`). The new 2026-07 surfaces (`events` filter, `activeSubscription`, `appSubscriptionCancel`) instead take `gid://shopify/App/1234` / `gid://shopify/Shop/5678`.
- Client permissions gate resources: View financials (transactions, `appCreditCreate`, `appSubscriptionCancel`), Manage apps (app, events, `activeSubscription`), Manage themes, Manage jobs.
- Rate limit: 4 requests/s per API client → `{"errors":[{"message":"Too many requests","extensions":{"code":"429"}}]}`. Many errors return HTTP 200 with an `errors` array; check `extensions.code`. Max query length 50000 chars. `Accept-Language: es` etc. localizes error messages.
- Transaction data is analytics-only — not for accounting/financial reporting.

## Core surface
| Operation | Purpose |
|---|---|
| `app(id: ID!): App` | One app: `id`, `name`, `apiKey`, `events` connection |
| `App.events(types, shopId, chargeId, occurredAtMin/Max, first/after)` | Install/charge event feed per app |
| `transactions(types, appId, shopId, myshopifyDomain, createdAtMin/Max, first/after)` | Org earnings ledger (TransactionConnection) |
| `transaction(id: ID!)` | Single transaction by GID |
| `publicApiVersions` | Supported/RC/unstable version handles |
| `events(filter, orderBy, first/after)` 2026-07 | Historical timeline: installs, charges, earnings, subscription states, credits |
| `activeSubscription(appId: ID!, shopId: ID!)` 2026-07 | Current managed-pricing subscription for a shop |
| `appSubscriptionCancel(appId!, shopId!, prorate!, skipFinalUsageCharge!, deferCancellation!)` 2026-07 | Cancel managed-pricing subscription; `prorate` mutually exclusive with the other two |
| `appCreditCreate(appId!, shopId!, amount: MoneyInput!, description!, test)` | Issue credit toward future app purchases |

`Money { amount: Decimal!, currencyCode: Currency! }`. `Shop { id, myshopifyDomain, name, avatarUrl }`. `AppEvent` interface: `app`, `occurredAt`, `shop`, `type`.

**`TransactionType`**: `APP_ONE_TIME_SALE` `APP_SALE_ADJUSTMENT` `APP_SALE_CREDIT` `APP_SUBSCRIPTION_SALE` `APP_USAGE_SALE` `LEGACY` `REFERRAL` `REFERRAL_ADJUSTMENT` `SERVICE_SALE` `SERVICE_SALE_ADJUSTMENT` `TAX` `THEME_SALE` `THEME_SALE_ADJUSTMENT`. Concrete `Transaction` types match: `AppSubscriptionSale`, `AppSaleAdjustment`, `AppSaleCredit`, `AppOneTimeSale`, `AppUsageSale`, `ThemeSale(Adjustment)`, `ServiceSale(Adjustment)`, `ReferralTransaction`, `ReferralAdjustment`, `TaxTransaction`, `LegacyTransaction`. Sale types expose `grossAmount`, `netAmount` (non-null), `shopifyFee`, `shop`; app sales add `app`, `chargeId`.

**`AppEventTypes`**: `CREDIT_APPLIED` `CREDIT_FAILED` `CREDIT_PENDING` `ONE_TIME_CHARGE_ACCEPTED` `ONE_TIME_CHARGE_ACTIVATED` `ONE_TIME_CHARGE_DECLINED` `ONE_TIME_CHARGE_EXPIRED` `RELATIONSHIP_DEACTIVATED` `RELATIONSHIP_INSTALLED` `RELATIONSHIP_REACTIVATED` `RELATIONSHIP_UNINSTALLED` `SUBSCRIPTION_APPROACHING_CAPPED_AMOUNT` `SUBSCRIPTION_CAPPED_AMOUNT_UPDATED` `SUBSCRIPTION_CHARGE_ACCEPTED` `SUBSCRIPTION_CHARGE_ACTIVATED` `SUBSCRIPTION_CHARGE_CANCELED` `SUBSCRIPTION_CHARGE_DECLINED` `SUBSCRIPTION_CHARGE_EXPIRED` `SUBSCRIPTION_CHARGE_FROZEN` `SUBSCRIPTION_CHARGE_UNFROZEN` `USAGE_CHARGE_APPLIED`. Concrete event objects use the PascalCase name (`RelationshipUninstalled { reason, description }`).

**`EventType` (2026-07 `events`)**: `RELATIONSHIP_{INSTALLED,UNINSTALLED,DEACTIVATED,REACTIVATED}` → `Relationship`; `SUBSCRIPTION_{CREATED,UPDATED,CANCELED,CANCELLATION_SCHEDULED,FROZEN,UNFROZEN}` → `SubscriptionStatus`; `CHARGE_{ONE_TIME,RECURRING,USAGE}` → `Charge`; `EARNING_{CHARGE_ONE_TIME,CHARGE_RECURRING,CHARGE_USAGE,REFUND,ADJUSTMENT,CREDIT}` → `Earning`; `CREDIT_{PENDING,APPLIED,FAILED}` → `Credit`.

## Examples (validated)
Earnings by type with cursor pagination (note `edges { cursor }`, not `pageInfo.endCursor`):
```graphql
query PayoutTransactions($cursor: String) {
  transactions(
    first: 50
    after: $cursor
    types: [APP_SUBSCRIPTION_SALE, APP_SALE_ADJUSTMENT, APP_USAGE_SALE]
    createdAtMin: "2026-01-01T00:00:00Z"
  ) {
    pageInfo { hasNextPage }
    edges {
      cursor
      node {
        id
        createdAt
        ... on AppSubscriptionSale {
          netAmount { amount currencyCode }
          grossAmount { amount currencyCode }
          shopifyFee { amount currencyCode }
          app { name }
          shop { myshopifyDomain }
        }
        ... on AppSaleAdjustment {
          netAmount { amount currencyCode }
          shop { myshopifyDomain }
        }
      }
    }
  }
}
```
Install/uninstall feed for one app:
```graphql
query AppUninstalls($appId: ID!, $cursor: String) {
  app(id: $appId) {
    name
    events(
      first: 50
      after: $cursor
      types: [RELATIONSHIP_UNINSTALLED, RELATIONSHIP_INSTALLED]
      occurredAtMin: "2026-06-01T00:00:00Z"
    ) {
      pageInfo { hasNextPage }
      edges {
        cursor
        node {
          type
          occurredAt
          shop { id myshopifyDomain }
          ... on RelationshipUninstalled { reason description }
        }
      }
    }
  }
}
```
Issue an app credit (View financials):
```graphql
mutation CreditForDowntime {
  appCreditCreate(
    appId: "gid://partners/App/1234"
    shopId: "gid://partners/Shop/5678"
    amount: {amount: 10.0, currencyCode: USD}
    description: "Credit for June downtime"
    test: true
  ) {
    appCredit { id amount { amount currencyCode } test }
    userErrors { field message }
  }
}
```
Historical events timeline (2026-07 only; validate with `--version 2026-07`):
```graphql
query RecentCharges($cursor: String) {
  events(
    filter: {
      subjectType: APP
      subjectId: "gid://shopify/App/1234"
      eventTypes: [CHARGE_RECURRING, CHARGE_USAGE, EARNING_CHARGE_RECURRING]
      occurredAtMin: "2026-07-01T00:00:00Z"
    }
    orderBy: OCCURRED_AT_DESC
    first: 100
    after: $cursor
  ) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        occurredAt
        eventType
        shop { myshopifyDomain }
        subject { ... on AppReference { name } }
        ... on Charge { chargeId amount { amount currencyCode } planHandle }
        ... on Earning { netAmount { amount currencyCode } settlementDate }
      }
    }
  }
}
```

## Gotchas
- `shopify validate graphql --api partner --file q.graphql` uses the CLI's bundled schema, which can lag (often 2026-04) — add `--version 2026-07` for `events`/`activeSubscription`. `appSubscriptionCancel` is absent from bundled schemas — check it against the docs.
- `events` filter: `shopId` requires `subjectId`; `subjectType` currently only `APP`; no dates → last 30 days; max `occurredAtMin`→`occurredAtMax` span 365 days; `first` max 250 — violations are execution errors.
- `activeSubscription`: public apps only; returns `null` when no managed-pricing contract. During trial, `currentBillingCycle` is null and `trialEndsAt` set. Each `items[].price` resolves to `FlatRatePrice { amount currency }` or `TieredPrice { tiersMode tiers { upTo amountPerUnit amount } }` (`tiersMode`: `VOLUME`|`GRADUATED`). `legacySubscriptionId` = Admin API `AppSubscription` GID for Billing-API-migrated subs, else null.
- `appSubscriptionCancel`: all three Boolean options required; `prorate: true` cannot combine with `skipFinalUsageCharge: true` or `deferCancellation: true`; deferred cancel → `cancelledAt: null`, `cancelAtEndOfCycle: true`. Errors arrive in `userErrors`, not top-level.
- `Transaction.chargeId` can be null for pre-September-2020 transactions. `TAX` transactions are rolled up one-per-payout (negative for sale fees, positive tax on referral commissions). `LEGACY` marks retired types.
- `ReferralCategory` incl. `AFFILIATE_STORES`, `TRANSFERRED_STORES`, `SHOPIFY_PLUS`, `POINT_OF_SALE`, `MARKETS_PRO`, `B2B_PROFIT_SHARE`.

## Docs
https://shopify.dev/docs/api/partner
https://shopify.dev/docs/api/partner/latest/queries/transactions
https://shopify.dev/docs/api/partner/latest/enums/TransactionType
https://shopify.dev/docs/api/partner/latest/enums/AppEventTypes
https://shopify.dev/docs/api/partner/latest/historical-events
https://shopify.dev/docs/api/partner/latest/active-subscription
https://shopify.dev/docs/api/partner/latest/app-subscription-cancel
https://shopify.dev/docs/api/partner/latest/mutations/appCreditCreate
