---
id: UNAUTHENTICATED_ENDPOINT
version: 2
severity: high
---

# Unauthenticated Endpoint

Find route handlers and controller actions that reach a sensitive read or
write of shop-scoped data without a verified request on every path that
reaches it.

A Shopify endpoint is unauthenticated when an outside request — another
app, a scraper, an attacker — can reach a handler that reads or modifies
shop data and no verification binds that request to an authenticated
principal before the sensitive action. The correct verification depends on
the entry point, and you must resolve the one actually in use rather than
recognize a spelling.

## Deterministic coverage and handoff

The deterministic implementation uses an AST to inspect exported loaders
and actions in the conventional `app/routes` layout. It resolves Shopify
imports, immutable aliases, and context produced by supported React Router
request-handler wiring. A missing-auth finding requires a resolved Admin
API operation before completed verification of the incoming request.

This is a bounded straight-line analysis, not general JavaScript execution
or proof of object-level authorization. Branches, catches, mutable or escaped
bindings, custom routing/middleware, opaque helpers, ambiguous context,
async instance factories, and parsing or resolution limits require review.
The name `context.shopify` alone is never evidence of an authentic instance.

When the review pack includes a deterministic fallback, inspect its listed
files and the missing verification path within the permitted review scope.
Keep the same check ID and report unsupported or unavailable evidence as
unresolved. A static coverage gap is neither a finding nor a pass; broader
agent review remains useful even when the supported static subset completed.

## Resolve actual verification

Do not match a token string. Trace the real authentication path for each
handler, including everything that hides it:

- **Embedded app pages** may use `authenticate.admin(request)`,
  `context.shopify.authenticate.admin(request)` (Remix/React Router),
  `ShopifyApp::EnsureHasSession` (Rails), or an equivalent session validator.
- **Webhooks and app proxies** verify their signed request, for example
  through `authenticate.webhook(request)` or
  `authenticate.public.appProxy(request)`. Follow the framework's actual
  signature verification before trusting request-derived shop context.
- **Service-to-service and staff/app endpoints** may use bearer tokens,
  a staff session, or mTLS rather than merchant-session authentication.
- **Intentionally public routes** can return public data without merchant
  authentication. Confirm that they do not expose credentials or protected
  operations; a public-looking route name alone proves nothing.

Follow every indirection before deciding a handler is verified or not:

- Resolve the loaded context — `context.shopify.authenticate` may be
  imported, destructured, injected, or built by a factory/DI container.
- Follow aliases, wrappers, re-exports, and helpers that call the real
  authenticator on the caller's behalf.
- In Rails, follow `before_action` / `before_action :authenticate` up the
  inheritance chain to the parent controller before flagging.
- In Express/Connect, follow middleware mounted above the route.
- `skip_idor_protection` and `protect_from_forgery` opt-outs are explicit
  exceptions — determine whether the remaining verification is sufficient.

## Verification must precede every sensitive action

Verification must dominate the sensitive action on every path that reaches
it, not merely appear somewhere in the handler:

- Asynchronous verification must be **awaited** or otherwise complete
  before the sensitive read/write. Synchronous middleware can enforce the
  same boundary without an `await` keyword.
- Verification failure must stop the protected operation. Propagating a
  rejection or exception is valid; an explicit `try/catch` is not required.
  A catch that swallows failure and continues to a sensitive sink is a bypass.
- An authenticator in an unrelated helper, an unexecuted branch, or after
  the protected operation is not a barrier. Resolve receiver identity too:
  a local no-op named `authenticate` does not verify anything.
- Bind verification to the actual incoming request and principal. A
  separately supplied shop selector is not made trustworthy by authenticating
  an unrelated session; investigate that under the tenant/authorization checks.

## Evidence and standards

Report a finding only when you can demonstrate all of:

1. **Reachability** — the handler is reachable from an outside request on
   a deployment path. Test/dev naming or a `test/` path is not proof of
   unreachability in production; do not treat naming as either safe or
   vulnerable.
2. **No verified request** — trace the actual authentication path, including
   inheritance, middleware, aliases, and factories, and show a reachable
   path to the sensitive action without completed verification that rejects
   invalid requests.
3. **A sensitive sink** — show a protected read or write of shop-scoped
   data, not merely a call named `graphql`, `prisma`, or `session`. Identify
   the concrete data or authority exposed to an unauthenticated caller.
4. **Principal, source, guard, sink, impact** — cite the file/line of the
   untrusted source, the missing or weak guard, the sensitive sink, and
   the affected authority or data.

Object authorization — acting on a shop other than the authenticated one —
is a distinct concern. Do not fold it into this check and do not report it
here unless the request itself is also unverified.

## What is not a finding

- A missing canonical import or helper name on its own — resolve the real
  path before concluding.
- Code that is genuinely unreachable on deployment paths — but
  unreachability asserted by naming convention alone is not a barrier;
  prove the deployment boundary.
- An intentionally public endpoint that exposes no protected data or action.
- A webhook/proxy handler whose signature verification you confirmed.

## When to stay unresolved

If you could not read the parent controller, the mounted middleware, the
DI factory, or the dependency that supplies the authenticator, you have
not established verification and you have not established a finding —
record the check as unresolved with the specific missing input. A missing
dependency or out-of-scope middleware means unresolved, not "safe" and not
"vulnerable".

Report every confirmed finding with file/line evidence for the source,
guard, sink, and impact, and record the check execution per the review
pack instructions.
