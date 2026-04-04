---
name: shopify-webhooks
description: "Gotchas and mental models for implementing Shopify webhooks correctly"
metadata:
  author: shopify
  version: "1.0"
---

# Shopify Webhooks

## Mental Model

Webhooks are Shopify pushing event data to your app. They are NOT reliable message queues. Treat them as best-effort notifications and design defensively.

## Two Subscription Methods (They Conflict)

- **App-specific**: Declared in `shopify.app.toml` under `[[webhooks.subscriptions]]`. Applied uniformly to all shops. Shopify's recommended approach.
- **Shop-specific**: Managed per-shop via `webhookSubscriptionCreate` GraphQL Admin API mutation. Supports `metafieldNamespaces` and product feed topics that app-specific does not.

**Critical**: If you have shop-specific subscriptions and add app-specific ones for the same topic, you get duplicates and conflicts. Before migrating to app-specific, query and delete existing shop-specific subscriptions for those topics first.

```toml
[webhooks]
api_version = "2024-07"

[[webhooks.subscriptions]]
topics = ["orders/create"]
uri = "pubsub://my-project:my-topic"
```

## Mandatory Compliance Webhooks

Three webhooks are **required for App Store approval** -- your app will be rejected without them:

| Topic | Trigger |
|---|---|
| `customers/data_request` | Customer requests their stored data |
| `customers/redact` | Store owner requests customer data deletion |
| `shop/redact` | Sent 48 hours after app uninstall for cleanup |

Must respond 200 and complete requested actions within 30 days. Note: `customers/redact` and `shop/redact` do not fire immediately in dev -- they are delayed by Shopify.

## No Ordering, Expect Duplicates

- Events are **not ordered** within a topic or across topics. A `products/update` can arrive before `products/create`.
- Duplicates happen. Deduplicate using the `X-Shopify-Event-Id` header (NOT `X-Shopify-Webhook-Id` which identifies the webhook, not the event).
- Use `X-Shopify-Triggered-At` or payload `updated_at` to determine recency.

## 5-Second Response Deadline

- Shopify expects a `200 OK` response within **5 seconds** total (connection + response).
- Connection must be accepted within **1 second**.
- Only 2XX codes count as success. 3XX redirects are treated as errors.
- After 8 consecutive failures over 4 hours, API-created subscriptions are **automatically deleted**. TOML-based subscriptions are not deleted but stop receiving.
- **Always queue and process async.** Never do business logic in the webhook handler.

## HMAC Verification (Do Not Skip)

Every HTTPS webhook includes `X-Shopify-Hmac-SHA256` -- a base64-encoded HMAC-SHA256 of the raw request body using your app's client secret.

Common mistakes:
- Using parsed/JSON body instead of the **raw body** for HMAC calculation
- Placing body-parsing middleware (e.g., `express.json()`) before webhook verification
- After rotating your client secret, HMAC uses the new secret after up to **1 hour**

If using `@shopify/shopify-app-express` or React Router template, `authenticate.webhook(request)` handles this automatically. Pub/Sub and EventBridge do not use HMAC (Shopify authenticates via the service account).

## Three Delivery Methods

| Method | URI format | HMAC? | Recommended? |
|---|---|---|---|
| Google Pub/Sub | `pubsub://{project}:{topic}` | No | Yes (preferred) |
| Amazon EventBridge | `arn:aws:events:{region}::event-source/...` | No | Yes |
| HTTPS | Relative or absolute URL | Yes | For simple setups |

Shopify recommends Pub/Sub or EventBridge for production. These handle queuing, retries, and scaling natively.

## Header Casing

Webhook HTTP header names are **case-insensitive** per HTTP spec. You may receive `X-Shopify-Topic`, `x-shopify-topic`, or any variant. Code that does exact-case matching will break.

## Key References

- Overview: https://shopify.dev/docs/apps/build/webhooks
- Subscribe (TOML): https://shopify.dev/docs/apps/build/webhooks/subscribe/get-started
- Subscribe (API): https://shopify.dev/docs/apps/build/webhooks/subscribe/subscribe-using-api
- HTTPS delivery: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
- Compliance: https://shopify.dev/docs/apps/build/privacy-law-compliance
- Topic reference: https://shopify.dev/docs/api/webhooks
- Troubleshooting: https://shopify.dev/docs/apps/build/webhooks/troubleshooting-webhooks
