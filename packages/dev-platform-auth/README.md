# @shopify/dev-platform-auth

`@shopify/dev-platform-auth` provides portable Shopify developer auth flows.

This package is currently a contract prototype. It defines separate Identity credential and application-access contracts plus `AuthProtocolError`; Identity device flow, `client_credentials`, and Store PKCE runtime modules will arrive in subsequent pull requests.

The portability contract is ESM on Node.js >=20, with no Node built-ins in the `.` entry. Only `.` and `./testing` are exported.
