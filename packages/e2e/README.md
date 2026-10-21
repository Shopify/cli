# E2E tests

Run local tests without Shopify credentials:

```sh
pnpm --filter e2e exec playwright test --project local
```

## Old store cleanup

`cleanup-stores.ts` remains available for old temporary stores. It excludes the `no-delete-e2e-` prefix and all stores configured in `E2E_STORE_FQDNS` or `E2E_STORE_FQDN`. Full and delete modes use five browser workers and the existing `store delete` behavior. Force mode sends API deletion requests with twenty workers and skips app checks. Confirmed deletions and requests still awaiting confirmation are reported separately. Force deletion can leave app installation records that prevent app deletion until the backend clears them.

Use `--list` first and select a narrow `--pattern`. These cleanup commands do not run as part of the persistent-store test lifecycle.
