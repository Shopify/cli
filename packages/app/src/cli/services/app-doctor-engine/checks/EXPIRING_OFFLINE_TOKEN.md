---
id: EXPIRING_OFFLINE_TOKEN
version: 1
severity: medium
---

# Expiring Offline Token

For supported React Router apps, verify `expiringOfflineAccessTokens` is enabled and the selected session storage persists `expires`, `refreshToken`, and `refreshTokenExpires` metadata needed for refresh and rotation. `isOnline: false` selects an offline session; it does not disable token expiry and is not a finding. Report an explicit `expiringOfflineAccessTokens: false`. Treat absent or computed flags, custom storage, and ambiguous Prisma schemas as unresolved investigation: inspect storage adapters, migrations, and serialization before returning a clean result. Config-only and unsupported frameworks are handled by the runtime applicability boundary.
