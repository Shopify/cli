# @shopify/dev-platform-auth

`@shopify/dev-platform-auth` provides portable Shopify developer auth flows.

This package currently provides the portable client-credentials contract and runtime, including transport types and testing helpers. Identity and Store PKCE flows are out of scope.

The portability contract is ESM on Node.js >=20, with no Node built-ins in the `.` entry. Only `.` and `./testing` are exported.
