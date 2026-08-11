# E2E failure report

| | last 7 days | previous 7 days |
|---|---|---|
| Runs where E2E ran | 217 | 35 |
| Runs with a failed shard | 56 (25.8%) | 1 (2.9%) |
| Failed shard jobs | 79 | 8 |

## Failure modes (primary, per failed shard)

| Mode | last 7 days | previous 7 days |
|---|---|---|
| partners-throttled | 32 | 0 |
| cli-died-waiting-ready | 12 | 0 |
| auth-setup-failed | 10 | 8 |
| store-provision-timeout | 9 | 0 |
| build-typescript-error | 6 | 0 |
| dashboard-delete-timeout | 5 | 0 |
| playwright-test-timeout | 3 | 0 |
| pnpm-install-failed | 2 | 0 |

_Window scanned this execution: 2026-08-04..2026-08-11. Unclassified failures carry a `firstError` snippet in failures.jsonl — name them in bin/e2e-failure-modes.json._
