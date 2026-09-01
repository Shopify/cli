---
id: KNOWN_CVE_IN_DEPENDENCY
version: 2
severity: medium
---

# Known Cve In Dependency

When deterministic package-manager audit is unavailable, inspect the JavaScript manifest and lockfile statically for known vulnerable dependency versions. Do not execute the repository's package manager, scripts, plugins, binaries, or configuration. If static evidence cannot confirm whether a dependency is vulnerable, mark the check unresolved instead of running repository-controlled code.
