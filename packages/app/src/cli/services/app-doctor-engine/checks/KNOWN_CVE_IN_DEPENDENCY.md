---
id: KNOWN_CVE_IN_DEPENDENCY
version: 3
severity: medium
---

# Known Cve In Dependency

When deterministic package-manager audit is unavailable, inspect the JavaScript manifest and lockfile statically for known vulnerable dependency versions. Do not execute the repository's package manager, scripts, plugins, binaries, or configuration. Distinguish version exposure from reachable impact: when source evidence allows it, check whether the app actually uses the vulnerable API or helper and whether the relevant configuration is enabled, especially for Shopify SDK behavior that depends on how a helper is called. If static evidence cannot confirm either the vulnerable version or the vulnerable API/helper reachability, mark the check unresolved instead of running repository-controlled code.
