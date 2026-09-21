---
id: DEPENDENCY_REACHABILITY
version: 1
severity: medium
---

# Dependency Reachability

Start from a static dependency or SDK finding and determine whether the app is
actually exposed to the vulnerable behavior. A vulnerable package version is not
enough by itself: confirm that the app uses the vulnerable API or helper, enables
the affected configuration, and exposes the relevant trust boundary.

## What to look for

1. **Identify the vulnerable version and advisory scope.** Read the manifest,
   lockfile, or deterministic finding and determine the exact package, version,
   vulnerable range, and affected API/helper/configuration from the advisory or
   shipped Shopify SDK behavior.

2. **Find imports and call sites.** Search for direct imports, wrapper helpers,
   generated clients, middleware, framework adapters, or transitive call paths
   that reach the vulnerable API or helper.

3. **Check configuration and feature gates.** Some vulnerabilities only apply
   when a flag, transport, parser mode, canonicalization shape, or optional
   feature is enabled. Verify the app actually enables the affected path.

4. **Trace the reachable impact.** Confirm which untrusted input can reach the
   vulnerable dependency behavior and what authority or data is exposed if the
   bug triggers.

5. **Distinguish version exposure from exploitability.** If the vulnerable
   package is present but the app never calls the affected API/helper, or the
   vulnerable configuration is disabled, keep the result unresolved rather than
   reporting a finding.

## What to report

Report a finding only when you can show:
- the vulnerable package or Shopify SDK version;
- the vulnerable API or helper in use;
- the enabling configuration or call shape;
- the untrusted input or trigger; and
- the resulting security impact.

Example:

```json
{
  "file": "app/services/session_verifier.ts",
  "line": 18,
  "message": "App uses vulnerable session-token helper without issuer validation",
  "evidence": [
    { "file": "package.json", "line": 12, "quote": "\"@shopify/shopify-app-remix\": \"x.y.z\"" },
    { "file": "app/services/session_verifier.ts", "line": 18, "quote": "verifySessionToken(token)" }
  ],
  "confidence": "high",
  "reasoning": "The installed SDK version contains the vulnerable helper implementation and the app calls that helper on attacker-controlled session tokens without an issuer check."
}
```

Do not report:
- a vulnerable version with no reachable use of the affected API/helper;
- dev-only tooling or test-only dependencies that cannot affect production;
- advisories whose required configuration is not enabled in this app;
- guessed exploitability when the call path or trigger cannot be established from source.
