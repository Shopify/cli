# @shopify/qa — CLI Pre-release QA flow runner

Automates the steps of the [CLI Pre-release QA flow doc](https://docs.google.com/document/d/1XX6QnS6kKZTT1shcCZVcso74VWn-Ui4V2IASenHHi1E/edit)
that need **no human interaction**, by driving the CLI directly (no Playwright,
no test framework): non-interactive commands run via `execa`, interactive ones
(`app dev`, `app config link`, `hydrogen init`) run in a pseudo-terminal via
`node-pty` and are driven with the same keypresses the doc describes (`g`, `q`,
Enter, CTRL+C).

Every checklist item of the doc is represented, in order:

- **auto** — executed by the runner.
- **manual** — needs a human. This covers browser/visual checks and the whole
  `shopify app dev` block (kept manual by team decision — it is an interactive
  session). Reported as `⏭️ manual` and listed in the "Remaining manual
  checklist" section of the summary — never silently dropped.
- **delegated** — the Theme section, owned by the themes team per the doc.

The summary (`qa-summary.md`, also appended to `$GITHUB_STEP_SUMMARY` on CI)
mirrors the QA doc structure section by section.

## Running locally

```sh
# Build the CLI first (the runner targets the repo build by default)
pnpm nx run-many --all --target=build

cd packages/qa
pnpm install

# Requires an authenticated CLI session (shopify auth login) or
# SHOPIFY_APP_AUTOMATION_TOKEN, plus an org:
QA_ORG_ID=<org-id> pnpm qa

# Run a subset while iterating:
QA_ONLY=hydrogen pnpm qa
QA_ONLY=prep,apps QA_ORG_ID=… pnpm qa
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `QA_CLI_BIN` | Path to the CLI under test. Default: `packages/cli/bin/run.js` (repo build). Point it at an installed `shopify` binary to QA a published version. |
| `QA_EXPECTED_VERSION` | Assert `shopify version` equals this (doc: "the version should match the nightly you just created"). |
| `QA_ORG_ID` / `E2E_ORG_ID` | Organization used by `app init`. |
| `QA_PACKAGE_MANAGER` | Package manager for `app init` (default `pnpm`). |
| `QA_ISOLATE` | `1` = fresh XDG dirs (don't reuse the local CLI session). Set on CI. |
| `QA_WORK_DIR` | Scratch dir (default: fresh temp dir). |
| `QA_ONLY` | Comma-separated section filter (`prep`, `general`, `apps`, `theme`, `hydrogen`). |
| `QA_REPORT_DIR` | Where `qa-summary.md` / `qa-report.json` are written (default `./qa-report`). |
| `SHOPIFY_APP_AUTOMATION_TOKEN` | Headless auth for app-platform commands on CI. |

## Auth

- **Locally**: the runner reuses your ambient `shopify auth login` session.
- **CI**: `QA_ISOLATE=1` plus `SHOPIFY_APP_AUTOMATION_TOKEN` (Genghis e2e org).
  Steps that turn out to require a browser user session are expected to fail
  loudly in the report rather than hang: every interactive prompt has a
  timeout that dumps the captured output.

## Relationship to packages/e2e

`packages/e2e` is the Playwright-based PR test suite. This package is
intentionally independent (per-team decision): it duplicates the few markers it
needs (e.g. the dev "Ready, watching for changes" string) instead of importing
from e2e, so the QA flow stays a faithful, standalone replica of the doc.
