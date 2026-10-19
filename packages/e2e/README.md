# E2E tests

Run local tests without Shopify credentials:

```sh
pnpm --filter e2e exec playwright test --project local
```

## Persistent development stores

App tests reuse existing stores. They never create or delete a store. Each test creates its own app and local files, then stops its dev process and attempts to remove its preview, uninstall its app, and delete the app. Stores can contain apps left by previous tests.

Create dedicated development stores once in the E2E organization and give the E2E account access. Use the `no-delete-e2e-` name prefix: the store cleanup script refuses to delete these stores, including in `--force` mode.

The store domains are defined in `E2E_STORES` in `setup/constants.ts`. Each of the seven dev cases selects a named store directly; store 8 is spare. Adding a test requires an explicit assignment, with no worker or shard allocation.

Copy `.env.example` to `.env` and supply the account, organization, and load-test header. Set `E2E_STORE_FQDN` to override the fixed assignments for local development. The test account must have access to the selected store.

Concurrent runs can use the same stores because each test creates a separate app and cleans only its own app and preview. Do not reuse the same app across concurrent runs. Keep local CLI processes in separate directories and use separate ports when running multiple suites on one machine.

## Browser use

Shared authentication and app deletion use the browser. Dev tests do not check store emptiness. App uninstall uses the Admin API. The legacy bulk cleanup scripts still use browser discovery, uninstall, and store-emptiness checks before store deletion.

## CI setup

Keep `E2E_ACCOUNT_EMAIL`, `E2E_ACCOUNT_PASSWORD`, `E2E_ORG_ID`, and `E2E_LOADTEST_HEADER` in Actions secrets. Store configuration does not require a repository variable.

CI passes `--shard 1/2` or `--shard 2/2` to Playwright and runs four workers per shard. Store assignment does not depend on the shard or worker count. E2E jobs do not lock the stores across runs.

App names and cleanup patterns include the run, attempt, and shard. Cleanup cannot select another run's apps or delete the fixed development stores.

To select one shard locally:

```sh
pnpm --filter e2e exec playwright test --project remote --shard 1/2
```

## Store lifecycle coverage

`tests/store-lifecycle.spec.ts` is the one exception to store reuse. It creates one temporary development store with `store create dev --json`, checks it with `store list --json`, and deletes it with `store delete --force --json`. It requires confirmed deletion and checks that the store is absent from the active store list. It runs once across the two remote shards and needs one free store slot in the E2E organization.

The lifecycle commands do not use a browser. They use the CLI session from shared authentication. The temporary store has an `e2e-store-` name with the run marker and a random suffix. Cleanup runs even when the test fails or `E2E_SKIP_TEARDOWN=1`, with a separate timeout. It finds only the exact test name and refuses to delete protected stores. The test report includes the temporary name for recovery if the runner stops before cleanup or provisioning finishes late.

Run only this test with:

```sh
pnpm --filter e2e exec playwright test tests/store-lifecycle.spec.ts --project remote --workers 1
```

## Failed or cancelled runs

Remote app cleanup failures produce warnings with the app name, store, failed step, and recovery command. Each later cleanup step is still attempted. These warnings do not fail an otherwise successful test or block the store from subsequent tests. Failure to stop a CLI process remains an error because the process can hold ports and keep making requests.

Recover leftover apps with `cleanup-apps.ts --pattern <run-attempt-shard>` or uninstall them in the store admin. Use the exact run marker from the failed run's app names and confirm that the run has stopped. Store reuse does not wait for this recovery.

`E2E_SKIP_TEARDOWN=1` deliberately leaves test apps installed. Use the cleanup script to remove them after debugging; their presence does not block store reuse.

## Old store cleanup

`cleanup-stores.ts` remains available for old temporary stores. It excludes the `no-delete-e2e-` prefix and all stores configured in `E2E_STORE_FQDNS` or `E2E_STORE_FQDN`. Full and delete modes use five browser workers and the existing `store delete` behavior. Force mode sends API deletion requests with twenty workers and skips app checks. Confirmed deletions and requests still awaiting confirmation are reported separately. Force deletion can leave app installation records that prevent app deletion until the backend clears them.

Use `--list` first and select a narrow `--pattern`. These cleanup commands do not run as part of the persistent-store test lifecycle.
