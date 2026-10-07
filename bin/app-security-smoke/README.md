# App security check smoke run

`run.js` runs real coding agents through `shopify app security` against a fresh React Router app template, then reports how each agent recorded the checks this calibration covers: `METAFIELD_OFFLINE_TOKEN`, `MISSING_AUTHORIZATION_CHECK` and `STATIC_FRAME_ANCESTORS`. Use it before and after changing agent check prompts or `INSTRUCTIONS.md`. It isn't run in CI: agent results vary from run to run, and each pass costs model time.

## What it runs

The script prepares two apps from [`Shopify/shopify-app-template-react-router`](https://github.com/Shopify/shopify-app-template-react-router) `main-cli`, pinned to the commit in `TEMPLATE_REF`:

- **template**: the app as `shopify app init` leaves it, with placeholder values for the fields that linking writes to `shopify.app.toml`. Every focus check should be recorded as `executed` with no findings. Apart from the focus checks, the template is expected to have findings only for `MISSING_COMPLIANCE_WEBHOOKS` and `MISSING_DEPENDENCY_SECURITY_AUTOMATION`. Any other unresolved check or finding is listed as `other`, but doesn't fail the run.
- **negative**: the template plus one planted bug per focus check. Each focus check should report a finding in its planted file:
  - `app/routes/api.demo-info.tsx` writes a request-controlled metafield through `unauthenticated.admin(shop)`.
  - `app/routes/app.cleanup.tsx` enforces an app-admin allowlist in its loader but not in its action, which deletes products.
  - `app/entry.server.tsx` replaces the SDK header with a `*.myshopify.com` frame-ancestors policy built from a variable.

Each pass gets its own copy of the app and runs the agent with a prompt to follow `shopify app security instructions`. A `shopify` shim on `PATH` points to this checkout's CLI.

## Usage

Run it in a disposable sandbox such as Aquifer or Spin, not on your laptop. Agents run with approvals and sandboxing turned off. You need `git`, `pnpm`, and the agent CLIs (`codex` and/or `claude`) already authenticated.

```sh
pnpm nx build cli
node bin/app-security-smoke/run.js --runs 3 --agents codex,claude
```

Options:

- `--runs`: passes per agent and scenario. Default 3.
- `--agents`: `codex`, `claude`, or both. Default both.
- `--scenarios`: `template`, `negative`, or both. Default both.
- `--concurrency`: number of passes run at the same time. Default 4.
- `--timeout-minutes`: per-pass timeout. Default 20.
- `--work-dir`: where to put apps, logs and `summary.json`. Defaults to a new temporary directory.

Agent commands default to `codex exec --dangerously-bypass-approvals-and-sandbox "$SMOKE_PROMPT"` and `claude -p --dangerously-skip-permissions "$SMOKE_PROMPT"`. Override them with `APP_SECURITY_SMOKE_CODEX_COMMAND` or `APP_SECURITY_SMOKE_CLAUDE_COMMAND`, for example to choose a model or a provider. The command runs through `sh -c` in the app directory, with the prompt in `$SMOKE_PROMPT`.

The script prints `PASS` or `FAIL` for each pass, then counts per scenario and check, for example `template: clean 5/6` and `negative: all planted bugs caught 6/6`. It exits 1 when any pass fails.

## Updating the template

The deterministic fixture test (`packages/app/src/cli/services/app-security-engine/tests/react-router-template.test.ts`) scans the same template without an agent. To move both to a new template commit, update `TEMPLATE_REF` in `run.js`, then run:

```sh
node bin/app-security-smoke/run.js write-fixture
```

This regenerates `tests/fixtures/react-router-template.ts`. Run the fixture test and this smoke run before committing.
