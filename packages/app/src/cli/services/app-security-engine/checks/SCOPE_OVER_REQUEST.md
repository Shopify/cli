---
id: SCOPE_OVER_REQUEST
version: 2
severity: high
---

Review whether the app's requested and effective OAuth access is necessary
for its supported behavior. Distinguish least-privilege recommendations
from demonstrated access beyond the intended authorization boundary.

A scope declaration is not proof of a live grant, data misuse, or a
privacy violation. Failure to find a matching API call is not proof that
a scope is unused. Report a finding only when repository evidence shows
a concrete excess-authority path and its security impact; do not turn a
configuration cleanup opportunity into a high-severity finding.

## What to look for

1. **Find the requested scopes and configuration.** Use the app config
   selected by the review workflow. Inspect `[access_scopes].scopes`,
   `required_scopes`, and `optional_scopes`, plus OAuth authorization URLs,
   environment configuration, and dynamic optional-scope requests when
   present. Do not combine declarations from unrelated apps or environments.

2. **Trace scope usage broadly.** Search for operations that exercise
   Shopify resources across the entire reviewed boundary, not only the
   entry directory:
   - REST and GraphQL API calls (`admin.rest`, `admin.graphql`,
     `client.get/post`, REST resource classes)
   - Generated or dynamically built GraphQL (template strings, query
     builders, `.graphql` files, codegen output)
   - Wrappers and SDK helpers that hide the underlying operation
   - Shared packages, monorepo workspaces, and background jobs reachable
     from the app
   - Flag-gated paths and optional features that may not run on every
     install but still exercise a scope when enabled

3. **Distinguish declared, requested, and granted scopes.** An optional
   declaration allows a later request; it does not establish that the
   merchant granted it. Deployment, installation, approval, and revocation
   can leave the current grant different from local configuration. Use
   available session, grant-query, and consent-handling evidence. State
   when the effective grant cannot be established rather than inventing it.

4. **Match exact operations to their scope requirements.** Use the
   applicable API version's field or mutation requirements, not keyword
   matches or a guessed resource-to-scope table. Account for implied
   access such as a write scope also granting read access, and for
   wrappers or generated queries that do not name the resource literally.

5. **Establish necessity before calling a scope excessive.** Compare the
   requested authority with supported features and reachable operations.
   A complete reviewed corpus with no use may justify cleanup guidance,
   but it does not by itself demonstrate a trust-boundary violation.
   Planned work is not proof a scope is necessary today, nor is the
   declaration alone a security finding. Identify the concrete data or
   operation exposed through the excessive authority before reporting it.

6. **Inspect scope-dependent behavior without inventing platform bypasses.**
   Follow optional-scope requests, consent handling, grant checks, and
   denied or revoked access through the affected feature. Shopify enforces
   API scopes server-side. A missing local declaration or preflight check,
   or an expected access-denied API response, does not establish
   unauthorized access. Report only a demonstrated excess-authority path,
   not an assumption that an API call succeeds without authorization.

7. **Keep API scopes and object authorization separate.** OAuth access
   scopes govern which resource classes an app may touch.
   Staff-permission or customer object-level authorization is a
   different boundary. If the real bug is missing object-level
   authorization or tenant isolation, refer to the owning check
   (`MISSING_AUTHORIZATION_CHECK`, `MISSING_TENANT_ISOLATION`) instead
   of duplicating it here.

8. **Respect review boundaries.** If the review pack scopes you to a
   subdirectory or a subset of the app, absence of a matching call
   inside that boundary is not proof of absence across the whole app.
   State the boundary you actually reviewed and mark scope-match
   questions unresolved when the unreviewed remainder could contain the
   usage.

## What to report

Use the generated review pack's current finding and execution schemas;
do not invent extra fields or a standalone JSON envelope.

A finding must identify:

- The selected configuration and the relevant scope declaration or request.
- The principal, intended authorization boundary, and requested authority.
- The reachable operation and concrete data or capability exposed through
  the excess authority, with file/line evidence for the complete path.
- Which effective-grant facts are established and which are unavailable.
- The reviewed directories, packages, helpers, and feature paths. Account
  for any unreviewed code that could change the conclusion.

Do not report a finding solely because:

- A scope is declared ahead of planned work or for an optional feature.
- No matching keyword or API call appears in one directory.
- The app is config-only and no source corpus is available.
- A scope is missing from local TOML, or an API call fails with access denied.
- A write scope is used for reads or implies another required scope.
- A declaration could theoretically increase the impact of a future leak,
  without a demonstrated excess-authority path in the reviewed code.

Keep supported least-privilege recommendations separate from findings.
Do not label planned scopes or documented intent as automatically safe:
comments and documentation are evidence to corroborate, not authorization.
If incomplete source, unknown feature reachability, or unavailable grant
evidence prevents a conclusion, record the check as unresolved with the
review pack's structured reason and guidance rather than asserting either
a vulnerability or a pass.
