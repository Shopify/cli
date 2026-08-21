# App Store review
Pre-submission compliance for Shopify App Store apps: numbered requirements (sections 1–5), review workflow, AI self-review, and rules that most often fail.

## Key facts
- Requirements were renumbered (Dec 2025) into IDs `1.1.1`–`5.x.x` under five sections; cite by number.
- GraphQL Admin API is mandatory for new public apps since Apr 1 2025; REST Admin API is legacy since Oct 1 2024 (`2.2.4`). Only Theme/Asset API REST usage is exempt.
- App Bridge: the CDN `app-bridge.js` script tag, before any other script (ideally first in `<head>`), is required since Mar 13 2024 (`2.2.3`). The `@shopify/app-bridge` npm package is outdated and gets flagged; use `@shopify/app-bridge-react` or `@shopify/app-bridge-react-router`.
- Embedded apps must use session tokens, working without third-party cookies/localStorage even in Chrome incognito (`1.1.1`); auto-checked at submission since Jan 6 2025, plus AI listing/screenshot checks.
- Draft apps calling APIs deprecated in ≤90 days are blocked from submitting (since Jan 6 2025).
- Billing: **Shopify App Pricing** (managed: plans defined in the submission form, Shopify hosts the plan page, usage via App Events API) is the default; Billing API flows are now "Manual Pricing (Legacy)". Off-platform billing prohibited (`1.2.1`); plan changes must work in-app without reinstall (`1.2.3`).
- Reviews policy `1.3` (Jul 2026): incentivized/fake reviews risk review removal, delisting, or Partner termination; untrusted reviews are unpublished. Ask in neutral language, ideally via the Reviews API (below).
- `4.1.2` (Jul 2026): app name must be unique and lead with your distinctive brand identifier; copycat names get delisted.
- Current stable API version: `2026-07` (quarterly; each supported ≥12 months).
- Submissions and quality-check audits are managed in the Partner/Dev Dashboard (App > Distribution), not over email.

## Requirement map
| Section | Groups |
|---|---|
| 1 Policy | `1.1` operate in-platform (session tokens; Shopify checkout only; no marketplaces, agency brokering, lending, third-party POS; refunds only via `refundCreate`/`returnProcess`); `1.2` Shopify billing only; `1.3` honest review practices |
| 2 Functionality | `2.1` no UI/web errors (404/500/3xx block review); `2.2` Shopify APIs, latest App Bridge, GraphQL Admin API; `2.3` install/OAuth flow |
| 3 Security | `3.1` valid TLS/SSL; `3.2` justify sensitive scopes |
| 4 Listing | `4.1` unique/consistent name; `4.2` pricing only in Pricing details; `4.3` truthful (no stats, guarantees, testimonials); `4.4` clear unique images, no Shopify trademarks; `4.5` complete submission |
| 5 Category-specific | `5.1` online store; `5.2` payments; `5.3` payment facilitator; `5.4` purchase options; `5.5` product sourcing; `5.6` checkout; `5.7` sales channel; `5.8` post-purchase; `5.9` mobile app builders; `5.10` donation; `5.11` blockchain |

## Rules that most often fail
- OAuth immediately after install and reinstall, before any UI (`2.3.2`, `2.3.4`); redirect to app UI after the grant screen (`2.3.3`); never ask merchants to type a `.myshopify.com` domain (`2.3.1`).
- Sensitive scopes need demonstrated in-code use (`3.2.x`): `read_all_orders`, `write_payment_mandate`, `write_checkout_extensions_apis`, `read_advanced_dom_pixel_events`, `read_checkout_extensions_chat`.
- Theme changes only via theme app extensions (`5.1.1`); Asset API/ScriptTag injection needs an approved exemption; ship onboarding instructions plus theme-editor deep links (`5.1.3`).
- No self-promotion, cross-promotion, or review requests in admin extensions (`2.2.6`), checkout extensions (`5.6.2`/`5.6.3`), Sidekick extensions (`2.2.9`), or theme extensions. App Name Branding in storefront components only when customers interact with it as part of buying (payment method, loyalty); else standard attribution ≤24×24 px (`5.1.4`).
- Checkout: no countdown timers (`5.6.6`); never collect payment info in a UI extension (`5.6.9`); explicit buyer consent before any charge that raises order total (`1.1.9`, `5.6.5`); cheapest shipping stays default (`1.1.10`).
- Max modal (formerly fullscreen) only after merchant interaction, never from the nav (`2.2.7`).
- Post-purchase: max 2 consecutive offers (`5.8.4`); preset accept and decline buttons (`5.8.2`); redirect back to order confirmation (`5.8.6`).
- Payments apps: scopes limited to `write_payment_gateways` + `write_payment_sessions` (`5.2.4`), `embedded = false` (`5.2.5`), test mode required (`5.2.11`).

## Mandatory compliance webhooks
Every App Store app must subscribe—even if it stores no personal data. Handle JSON `POST`s, verify HMAC (`401` on invalid `X-Shopify-Hmac-SHA256`), acknowledge with `200`, act within 30 days.

| Topic | Trigger |
|---|---|
| `customers/data_request` | Customer wants their stored data; payload lists `orders_requested` IDs |
| `customers/redact` | Delete customer data; sent 10 days after request if no order in 6 months, else withheld 6 months |
| `shop/redact` | 48 h after uninstall; erase the shop's data |

```toml
[webhooks]
api_version = "2026-07"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://app.example.com/webhooks"
```

Manual HMAC check (the React Router template's `authenticate.webhook` handles this):

```js
const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.raw({type: '*/*'}));
app.post('/webhooks', (req, res) => {
  const digest = crypto.createHmac('sha256', process.env.CLIENT_SECRET).update(req.body).digest('base64');
  if (!crypto.timingSafeEqual(Buffer.from(digest, 'base64'), Buffer.from(req.headers['x-shopify-hmac-sha256'], 'base64'))) return res.status(401).send('invalid HMAC');
  res.status(200).send('ok');
});
app.listen(3000);
```

1 s connect / 5 s total timeout; non-2xx (even 3xx) is failure; 8 failed retries over 4 h delete Admin API-configured subscriptions.

## Protected customer data
Level 1 = customer data excluding name, address, phone, email; level 2 includes those fields, each approved individually and subject to data protection reviews. Request via Partner Dashboard **API access requests**—impossible while under review; dev-store-only apps skip it. Unapproved fields come back redacted; GraphQL replies `200` with the redaction explained in `errors`. Level 1 requirements: data minimization, stated purposes, consent/opt-out handling, retention limits, encryption at rest and in transit. Level 2 adds encrypted backups, test/prod separation, data-loss prevention, limited staff access, access logs, incident response policy.

## Requesting reviews (Reviews API, App Home)
```js
const result = await shopify.reviews.request();
if (!result.success) console.log(`${result.code}: ${result.message}`);
```
Modal shows at most once per 60 days, 3× per 365 days; declined codes: `already-reviewed`, `mobile-app`, `merchant-ineligible`, `recently-installed` (<24 h), `cooldown-period`, `annual-limit-reached`, `already-open`, `open-in-progress`, `cancelled`. Dev stores bypass limits; their reviews aren't published. Request after a successful workflow, not on first open.

## Performance targets
- Storefront: must not drop Lighthouse score >10 points (weighted: home 17%, product 40%, collection 43%).
- Built for Shopify prerequisites: ≥50 net installs from active paid shops, ≥5 reviews, minimum recent rating. Admin Web Vitals at p75: LCP ≤2.5 s, CLS ≤0.1, INP ≤200 ms (≥100 calls/28 d each; measured via latest App Bridge). Checkout carrier rates: p95 ≤500 ms, ≤0.1% failures (≥1000 req/28 d).

## Review workflow
Statuses: **Draft → Submitted → Reviewed → Published**; **Paused** if core requirements block review (fix, then "Submit fixes"); **Suspended** after repeated bad submissions. Withdraw anytime.

Submission checklist: demo screencast of setup and core features (English or English subtitles—mandatory), valid full-access test credentials, emergency developer contact, app icon 1200×1200 JPEG/PNG, no "Shopify" (or misspellings) in app domains or API contact email, billing tested with `"test": true` then flipped to `"test": false`.

Listing rules: no pricing in images or the icon; each screenshot unique, showing actual app UI (no browser chrome or desktop backgrounds); accurate tags and language claims.

Failures forcing full re-submission: broken install/OAuth redirect, embedded/non-embedded switching, broken UI or web errors, missing test instructions, theme-extension violations. Billing fixes don't.

## AI self-review
Fetch the canonical code-checkable requirements (with per-requirement verification guidance):
```
shopify doc fetch --url https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements
```
Grade each as likely passing / likely failing / needs review; numbering gaps are intentional (submission-time-only checks omitted). Category groups are gated by config signals: 5.1 needs `shopify.extension.toml` with `type = "theme"`; 5.2 `type = "payment"` + `write_payment_gateway` scope; 5.4 subscription-contract or payment-mandate scopes; 5.6 checkout-targeted `ui-extension`; 5.7 `type = "channel_config"`; 5.8 `type = "checkout_post_purchase"`; 5.3/5.5/5.9/5.10 are opt-in only. Listing content, live behavior, and UX still get human review after submission.

## Docs
https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements
https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review
https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review
https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
https://shopify.dev/docs/apps/launch/protected-customer-data
https://shopify.dev/docs/apps/launch/built-for-shopify/requirements
https://shopify.dev/docs/apps/launch/marketing/manage-app-reviews
