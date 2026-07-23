# Payments Apps API
Payments Partner GraphQL API: finalize payment/refund/capture/void sessions initiated by Shopify's HTTP calls to your payments extension; 3-D Secure, confirm, gateway readiness.

## Facts that override stale training data
- Current stable: `2026-07` (quarterly). Own endpoint, NOT the Admin API: POST `https://{shop}.myshopify.com/payments_apps/api/2026-07/graphql.json`, header `X-Shopify-Access-Token`. Extension TOML `api_version` sets both the version Shopify sends and the version you must call; never `unstable` in production.
- Only approved Payments Partners can build; custom payments extensions limited to eligible Shopify Plus merchants.
- Scopes: `write_payment_sessions` (all *Session* mutations), `write_payment_gateways` (`paymentsAppConfigure`), `read_payment_sessions`. Write scopes are auto-granted through the payments extension — omit from `shopify.app.toml` on first deploy. Payments apps are extension-only: set `embedded = false`.
- Everything is async and idempotent: Shopify POSTs to your session URLs, you ACK immediately (2xx/201), then finalize via mutation using the request's `gid`. Resolve and reject are final and mutually exclusive; repeat calls succeed but ignore arguments.
- Request `id` = idempotency key and merchant-facing payment reference; no order ID in any payments request. Refund `payment_id` = the original authorization's payment ID, never the capture ID.
- `RISKY` rejection reason is deprecated — use `FRAUD_SUSPECTED`/`HIGH_RISK_FRAUD_SUSPECTED`/`CARD_TESTING`.
- Buyer abandoning offsite payment (`cancel_url`) must NOT trigger `paymentSessionReject` — the buyer could never retry with your provider.
- No top-level session queries and no extra data back to Shopify — retain session state yourself.

## Mutations (all take the session `gid` as `id`)
| Mutation | Args beyond `id: ID!` | Purpose |
| - | - | - |
| `paymentSessionResolve` | `authentication`, `authorizationExpiresAt`, `networkTransactionId`, `paymentDetails` | Payment succeeded (`sale`=charged, `authorization`=hold) |
| `paymentSessionReject` | `reason: PaymentSessionRejectionReasonInput!` (`code!`, `merchantMessage`, `source`), `authentication`, `paymentDetails` | Payment failed |
| `paymentSessionPending` | `pendingExpiresAt: DateTime!` (≤3 days recommended), `reason!`: `{BUYER,MERCHANT,NETWORK,PARTNER}_ACTION_REQUIRED` | Await async completion; redirect buyer back via `nextAction`; must still resolve/reject |
| `paymentSessionRedirect` | `redirectUrl: URL!` | Send buyer to 3DS page (credit card only; iframed) |
| `paymentSessionConfirm` | — | Ask Shopify to confirm (inventory/3DS); result POSTed to `confirmation_callback_url` |
| `paymentSessionModal` | `action: ModalAction!`, `expiresAt` | Post-checkout buyer modal |
| `refundSessionResolve` / `refundSessionReject` | reject: `reason!` (`code`: `PROCESSING_ERROR`, `merchantMessage`) | Finalize refund |
| `captureSessionResolve` / `captureSessionReject` | reject: `reason!` (`code`: `AUTHORIZATION_EXPIRED\|PROCESSING_ERROR`) | Finalize capture (`kind: authorization` only) |
| `voidSessionResolve` / `voidSessionReject` | reject: `reason!` (`code`: `PROCESSING_ERROR`) | Finalize void (`kind: authorization` only) |
| `paymentsAppConfigure` | `ready: Boolean!`, `externalHandle` | Mark gateway ready at onboarding |

`PaymentSession`: `id`, `state: PaymentSessionStates!` (union `PaymentSessionState{BuyerActionRequired,Confirming,Pending,Redirecting,Rejected,Resolved}`, each has `code`), `nextAction { action context { ... on PaymentSessionActionsRedirect { redirectUrl } } }`, `authorizationExpiresAt`, `pendingExpiresAt`.

## HTTP requests from Shopify (URL keys from extension TOML)
Headers: `Shopify-Shop-Domain`, `Shopify-Request-Id`, `Shopify-Api-Version`. Shared body: `id`, `gid`, `test`, `merchant_locale`, `proposed_at`; payment starts add `group`, `session_id` (2024-10+), `amount` (decimal string), `currency` (ISO 4217), `kind` (`"sale"|"authorization"`), `customer` (`email`/`phone_number`, `billing_address`/`shipping_address`), `transaction_metadata` (`shipping`+`tax_amount` 2024-01+, `order_level_discount`, `localized_fields` 2024-07+, e.g. Brazil CPF).
| Flow | URL key | Your response |
| - | - | - |
| Payment (offsite) | `payment_session_url` | 200 + `{"redirect_url": "https://buyer-payment-page.com/12345"}` <8192 bytes |
| Payment (credit card) | `payment_session_url` | 200, empty body |
| Refund / Capture / Void | `refund_session_url` / `capture_session_url` / `void_session_url` | 201, empty body (`payment_id`, `amount` in request; void has no amount) |
| Confirm result | `confirmation_callback_url` | 200 (body has `confirmation_result: Boolean`) |
Credit card `payment_method.data`: `fingerprint`, `encrypted_message`, `ephemeral_public_key`, `tag`, `moto` (2024-07+) — ECIES-encrypted card data; decrypt only in a PCI DSS environment. 3DS extensions also get `client_details` (`ip_address`, `user_agent`, `accept_language`).

## Extension config (`extensions/<name>/shopify.extension.toml`)
```toml
api_version = "2026-07"

[[extensions]]
name = "acme-payments"
type = "payments_extension"
merchant_label = "Acme Payments"
payment_session_url = "https://acme.example.com/payment"
refund_session_url = "https://acme.example.com/refund"
supported_countries = ["US", "CA"]
supported_payment_methods = ["visa", "master"]
supports_3ds = false
supports_installments = false
supports_deferred_payments = false
test_mode_available = true

[[extensions.targeting]]
target = "payments.offsite.render"
```
Targets: `payments.offsite.render`, `payments.credit-card.render`, `payments.custom-credit-card.render`, `payments.custom-onsite.render`, `payments.card-present.render`, `payments.redeemable.render`. Optional keys: `capture_session_url`/`void_session_url` (manual capture/void), `multiple_capture` (partial captures up to authorized total), `confirmation_callback_url` (required for inventory confirmation; enables `paymentSessionConfirm`), `buyer_label` + `[[extensions.buyer_label_translations]]` (`label`, `locale`); credit card: `supports_moto`, required `encryption_certificate_fingerprint`; custom onsite: `ui_extension_handle`, `[[extensions.checkout_payment_method_fields]]` (`key`, `type`, `required`). Scaffold: `shopify app init --template none`, `shopify app generate extension` → Payments extensions; ship via `shopify app deploy`.

## Operations (validated against 2026-07)
```graphql
mutation ResolvePayment($id: ID!) {
  paymentSessionResolve(id: $id) {
    paymentSession {
      id
      state { ... on PaymentSessionStateResolved { code } }
      nextAction { action context { ... on PaymentSessionActionsRedirect { redirectUrl } } }
    }
    userErrors { field message }
  }
}
```
```graphql
mutation RejectPayment($id: ID!, $reason: PaymentSessionRejectionReasonInput!) {
  paymentSessionReject(id: $id, reason: $reason) {
    paymentSession { id state { ... on PaymentSessionStateRejected { code reason merchantMessage } } }
    userErrors { field message }
  }
}
```
```json
{"id": "gid://shopify/PaymentSession/u0nwmSrNntjIWozmNslK5Tlq", "reason": {"code": "CARD_DECLINED", "merchantMessage": "Card declined by issuer."}}
```

## 3-D Secure & confirm gotchas
- Flow: `paymentSessionRedirect` → Shopify iframes your URL → after auth, `paymentSessionConfirm` → Shopify POSTs `confirmation_result` to `confirmation_callback_url` → resolve/reject (these FAIL until Shopify has sent the confirmation result). Navigate back via the parent browsing context, not top-level.
- `confirmation_result: false` → MUST reject with `CONFIRMATION_REJECTED`. Failed/declined 3DS auth → reject with `AUTHENTICATION_FAILED` (no confirm call needed).
- `authentication` arg on resolve/reject is required iff `paymentSessionRedirect` was called and method is credit card. Exactly one of `authenticationData` / `partnerError`. `authenticationData`: `version!` (`V1_0|V2_1|V2_2|V2_3|UNKNOWN`), `transStatus!` (`Y|A|N|U|R|I`), `authenticationFlow!` (`FRICTIONLESS|CHALLENGE|UNKNOWN`), `chargebackLiability!` (`MERCHANT|UNKNOWN`; `UNKNOWN` invalid when transStatus `N`/`R`), `dsTransactionId`, `transStatusReason` (required for `N|U|R`).

## `PaymentSessionStateRejectedReason` codes
`AMOUNT_TOO_LARGE AMOUNT_TOO_SMALL AUTHENTICATION_FAILED AUTHENTICATION_REQUIRED CALL_ISSUER CANCELLED_PAYMENT CARD_DECLINED CARD_TESTING CONFIRMATION_REJECTED DO_NOT_HONOR EXPIRED_CARD FRAUD_SUSPECTED HIGH_RISK_FRAUD_SUSPECTED INCORRECT_ADDRESS INCORRECT_CVC INCORRECT_NUMBER INCORRECT_PIN INCORRECT_ZIP INSTRUMENT_DECLINED INSUFFICIENT_FUNDS INVALID_AMOUNT INVALID_CURRENCY INVALID_CVC INVALID_EXPIRY_DATE INVALID_NUMBER INVALID_PAYMENT_METHOD INVALID_PURCHASE_TYPE INVALID_REQUEST MERCHANT_ACCOUNT_ERROR MERCHANT_RULE PAYMENT_METHOD_UNSUPPORTED PICK_UP_CARD PROCESSING_ERROR RETRY_DECLINED TRANSACTION_LIMIT_EXCEEDED`

## Other gotchas
- Onboarding: merchant installs via install link → configures on your page → app calls `paymentsAppConfigure(ready: true)` → merchant activates. Not ready = activation blocked.
- Rate limited by query cost; errors return HTTP 200 with `errors[].extensions.code`: `THROTTLED`, `ACCESS_DENIED`, `SHOP_INACTIVE`, `MAX_COST_EXCEEDED`.
- `test: true` sessions arrive when the provider is in test mode (`test_mode_available = true`); process without moving real money.
- Only reject captures/refunds/voids on final, irrecoverable errors — otherwise retry resolving.
- Validate locally: `shopify validate graphql --api payments-apps`.

## Docs
https://shopify.dev/docs/api/payments-apps/latest
https://shopify.dev/docs/apps/build/payments/processing
https://shopify.dev/docs/apps/build/payments/request-reference
https://shopify.dev/docs/apps/build/payments/offsite/use-the-cli
https://shopify.dev/docs/apps/build/payments/credit-card/use-the-cli
https://shopify.dev/docs/api/payments-apps/latest/enums/PaymentSessionStateRejectedReason
