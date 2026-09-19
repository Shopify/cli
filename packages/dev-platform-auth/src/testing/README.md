# Auth contract fixtures

These fixtures are an independent transport contract for developer authentication. They have two layers:

- **Layer 1 — pinned transport:** `request`, `responses`, and `transportCitation`. These pin the cited response structure, HTTP status, and content type. Response values are arbitrary, obviously fake fixture data unless the citation states otherwise; values such as `599` and `fixture-access-token` are not captured production facts. A citation is required for every fixture. The transport harness rejects calls after the declared response sequence, so polling count remains observable. Do not change Layer 1 cases to make a port pass.
- **Layer 2 — provisional outcomes:** `expected` and `provisionalOutcome`. These describe possible package conclusions and open questions. They are not a frozen error taxonomy. Layer 2 is intentionally open and changeable: propose a decision with characterization evidence and explicit review rather than silently changing it.

Cancellation fields (`required`, `optional`, and `absent`) are Layer 2 design notes. No cli-kit auth function accepts a cancellation signal, so they do not define a current equivalence contract. Fixed expiry outcomes state the injected clock in their provisional note. Dynamic server fields such as `expires_in` are checked for presence and type, not pinned to an observed number.

The fixtures use fake values only. `createFixtureFetch` has no HTTP or Node runtime dependency, so CLI and app SDK adapters can use the same data.

## Resolving citations

Citations name a file and line range but not a repository. Resolve them against these roots, or they will appear not to exist:

| Citation looks like | Repository | Root to resolve against |
| --- | --- | --- |
| `packages/cli-kit/...` | `Shopify/cli` | repository root |
| `app/...`, `lib/rack/...`, `config/...`, `db/schema.rb` | `shopify/identity` | **`areas/platforms/identity/`**, not the repository root |
| `spec/...` | `shopify/identity` | `areas/platforms/identity/` |
| `*.test.ts` described as oracle | `Shopify/cli`, branch `donald/auth-characterization-tests` | repository root |

Identity evidence was read at revision `b0a0a25efe32489cc4e24541c4a3bd653b262f97`; the characterization oracle at head `b95944ae09`. Line numbers drift, so confirm the quoted behavior rather than trusting the range. An Identity path checked from the repository root instead of `areas/platforms/identity/` will look fabricated when it is not.

## Coverage gaps

The 12 cases are not a complete oracle. The following Identity/cli-kit behavior is intentionally not covered:

- Device authorization missing `verification_uri_complete` and its `BugError`.
- Malformed, empty, HTML, and other non-JSON responses.
- CI/noninteractive abort behavior.
- Unknown device errors mapping to `unknown_failure`.
- Device success expiry, scopes, and user ID from a valid JWT.
- The full refresh error family: `invalid_grant`, `invalid_request`, and `invalid_target`.
- All non-admin token-exchange audiences and their exact scopes.
- Client-credentials `app_not_installed` and non-JSON handling.

Where server reality and cli-kit behavior differ, the fixture keeps the cli-kit equivalence behavior as the provisional expectation and records the divergence. In particular, Identity's `slow_down` response has no `interval`; cli-kit still applies a fixed +5-second client-policy increment.
