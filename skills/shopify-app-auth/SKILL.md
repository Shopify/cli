---
name: shopify-app-auth
description: "Decision guide for Shopify app authentication: token exchange, OAuth, credentials, and token types"
metadata:
  author: shopify
  version: "1.0"
---

# Shopify App Authentication

## Decision Tree: Which Auth Flow?

```
Is your app embedded in Shopify Admin?
├─ YES → Token Exchange (recommended)
│   App Bridge session token → exchange for access token
│   No redirects. Seamless UX.
│
├─ NO (standalone web app) → Authorization Code Grant (OAuth)
│   Standard OAuth 2.0 redirect flow.
│   Merchant sees consent screen → redirect back with code → exchange for token.
│
└─ Backend-only service (no user interaction) → Client Credentials Grant
    App acts on its own behalf. No merchant/user context.
    Limited to app-level permissions only.
```

## Critical Confusion: Session Tokens vs Access Tokens

These are NOT the same thing. Mixing them up is the #1 auth mistake.

| | Session Token | Access Token |
|---|---|---|
| **What** | Short-lived JWT from App Bridge | Credential for calling Shopify APIs |
| **Issued by** | App Bridge (frontend) | Shopify OAuth endpoint (backend) |
| **Lifetime** | ~1 minute | Hours (online) or indefinite (offline) |
| **Used for** | Proving the request comes from an embedded app | `X-Shopify-Access-Token` header on API calls |
| **Alone?** | Cannot call APIs directly | Yes, this is what calls APIs |

Flow: App Bridge issues session token → your backend receives it → exchanges it for an access token → uses access token to call Admin API.

## Online vs Offline Access Tokens

| | Online | Offline |
|---|---|---|
| **Scope** | Per-user (merchant staff) | Per-store |
| **Lifetime** | Expires within 24 hours | Non-expiring (default) or expiring w/ refresh token |
| **Use when** | You need user-specific permissions or audit trails | Background jobs, webhooks, most common case |
| **Token exchange param** | `requested_token_type: urn:ietf:params:oauth:token-type:access_token` | `requested_token_type: urn:shopify:params:oauth:token-type:offline-access-token` |

**Most apps need offline tokens.** Use online only when you need to scope actions to a specific staff member.

## Embedded App Auth (Token Exchange)

1. Frontend: App Bridge automatically provides a session token
2. Backend: Validate the session token on every incoming request
3. Backend: POST to `https://{shop}.myshopify.com/admin/oauth/access_token` with:
   - `client_id`, `client_secret`
   - `grant_type: urn:ietf:params:oauth:grant-type:token-exchange`
   - `subject_token: <session_token>`
   - `subject_token_type: urn:ietf:params:oauth:token-type:id_token`
4. Use returned access token in `X-Shopify-Access-Token` header

Shopify CLI templates (`shopify app generate`) handle this automatically.

## Scopes

- Declared in `shopify.app.toml` under `[access_scopes]`
- Requested at install time; merchant grants consent
- Changing scopes requires re-authorization (merchant sees consent screen again)
- Example: `scopes = "read_products,write_orders"`

## HMAC Verification

Two contexts where you verify HMAC signatures:

- **Webhooks**: Verify `X-Shopify-Hmac-Sha256` header against raw request body using app client secret (HMAC-SHA256, base64-encoded). The `shopify-app-react-router` library's `authenticate.webhook()` handles this.
- **OAuth install requests**: Verify `hmac` query parameter by sorting remaining params, computing HMAC-SHA256 with client secret.

Pitfall: You must use the **raw request body** for webhook HMAC. If middleware (e.g., `express.json()`) parses the body first, verification will fail.

## CLI Auth Note

`shopify auth login` opens a browser for human interaction. It cannot be automated or scripted in CI. For CI/CD, use environment variables (`SHOPIFY_CLI_PARTNERS_TOKEN`) or app-level client credentials.

## Documentation

- Overview: https://shopify.dev/docs/apps/build/authentication-authorization
- Access tokens: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- Token exchange: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
- OAuth code grant: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
- Session tokens: https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
- Scopes: https://shopify.dev/docs/api/usage/access-scopes
