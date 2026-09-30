# Command test standard

Use `test/app-info.test.ts` and `test/README.md` as working examples. Keep tests readable without opening an expected-output file.

## Files and APIs

Use one `test/<command-slug>.test.ts` file per command. Put its test-design documentation under `test/<command-slug>/`, starting with `README.md` and `coverage.md`. Add focused profiles there when one index would become hard to scan. Put new filesystem scenarios under `test/fixtures/<command-slug>/<scenario>/project/`; keep existing catalog paths. Ancestor/sibling inputs can sit beside `project/`.

Keep reusable command-testing guidance in this skill. Keep expected output in the test. Do not place command-specific test plans under `docs/`.

Reuse the existing support layers:

| File                                     | Responsibility                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `test/support/build.ts`                  | Build the actual CLI bundle and test preload                           |
| `test/support/fixture.ts`                | Fixture lifecycle, app-info defaults, execution, observations          |
| `test/support/filesystem.ts`             | Independent copies, symlink/path checks, immutable-source verification |
| `test/support/state.ts`                  | Real platform-specific persistent state                                |
| `test/support/process.ts`                | Bash/PTY execution, deadlines, input and process cleanup               |
| `test/support/preload.ts`, `protocol.ts` | Network interception, scripted subprocesses, trace events              |
| `test/support/scenarios.ts`              | App-specific network/authentication presets                            |
| `test/support/observations.ts`           | Normalization and filesystem comparisons, not expected values          |

`fixture.reserve(name)` currently reads `test/fixtures/app-information/`. A new command may need an explicit catalog/preset option or a command-specific fixture. Preserve the existing suite when changing this interface; do not silently reuse app-info defaults for unrelated commands.

Keep these API meanings:

- `reserve(name)`: copy one complete filesystem input into a fresh sandbox.
- `seedState(...)`: write actual authentication, app preferences, CLI preferences, and caches. It does not mock storage.
- `configure(...)`: set environment, cwd, clock, request limits, or owned loopback ports.
- `mockNetwork(...)`: register or override intercepted HTTP responses.
- `mockSubprocess(...)`: script an external command's arguments and result, without executing that command.
- `runShopifyCommand(argv, options)`: run the real CLI through bash.
- `readFile`, `readStore`, and before/after snapshots: observe actual effects.
- `writeFile`, `writeFileAt`, and `removeFile`: runtime-dependent inputs or deliberate changes between invocations, not ordinary static fixture construction.

## Test layout

The subject under test is a fresh invocation of `packages/cli/bin/run.js`, not a command class, service, or prepared in-memory app object. Keep shell argv separate from shell source.

```ts
import {test, clientId} from './support/fixture.js'
import {expect} from 'vitest'

test('prints the web environment as JSON', async ({fixture}) => {
  // GIVEN
  await fixture.reserve('linked-app')

  // WHEN
  const argv = ['app', 'info', '--web-env', '--json']

  // THEN
  const result = await fixture.runShopifyCommand(argv)
  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe('')
  expect(JSON.parse(result.stdout)).toEqual({
    SHOPIFY_API_KEY: clientId,
    SHOPIFY_API_SECRET: 'synthetic-app-secret',
    SCOPES: 'read_products',
  })
})
```

The first statement in `THEN` invokes the command. A cache-warming invocation can be part of `GIVEN`, but the measured invocation still starts `THEN`. Use `test.for` for equivalent assertions across distinct inputs. Leave a blank line between tests and describe blocks.

## Fixtures and external dependencies

- Copy complete scenarios into independent writable directories. Use ordinary copies, not hardlinks or overlays that fill intentionally missing files.
- Keep source fixtures immutable. Preserve relative links only within the scenario; reject escaping links and harness-path collisions.
- Use real files, stores, directory collisions, and fixture-owned sockets. Do not mock the filesystem.
- Use synthetic credentials and reset the child environment. Isolate HOME, platform store paths, XDG/APPDATA, temp, framework directories, and executable resolution.
- Keep unregistered requests, sockets, and subprocesses fatal to the test even when the CLI catches the error.
- Script browsers, installers, and deployment tools. An allowlisted subprocess must not become permission to launch its real executable.
- Do not set `SHOPIFY_UNIT_TEST`: it changes the runtime contract being tested.

Fixture TOML/JSON can be intentionally invalid. Ensure it is excluded from Nx project discovery, TypeScript, ESLint, and formatting, while remaining visible to Git. Preserve `.env`, synthetic package contents, symlinks, binary bytes, and deliberately empty directories. Update exclusions only for the new fixture tree.

## Assertions that establish behavior

Put expected objects, strings, diagnostics, and parameter-table values in the test file. Use exact comparisons for meaningful payloads and configuration objects. Keep helpers limited to setup, execution, observation, or normalization.

Use explicit expected values instead of external snapshots or automatic snapshot updates. Large inline dumps of repeated specification objects and deploy-step metadata add noise too. Compare the fields the scenario changes, representative complete report content, and relevant omissions. Record which serialized internals are intentionally outside those comparisons.

| Weak assertion or fixture                  | Stronger test                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Nonzero exit and nonempty stderr           | Expected exit, diagnostic identifying the cause, correct stream, and required partial side effects |
| Any output after a collected error         | Expected report/env payload followed by exit 2, where that is the observed command contract        |
| Retry count only; identical old/new tokens | Distinct tokens, correct exchange subject, new bearer on replay, updated store                     |
| Search result has the original app ID      | Different identities; assert the selected request, saved config, and report                        |
| Latest version listed first                | Unsorted versions with unstable entries; assert the chosen stable version                          |
| Generated file lacks one marker            | Assert retained base types and the complete relevant declaration/type wiring                       |
| Warm run skips requests                    | Also assert correct cached values and changed uncached values in the report                        |
| Permitted network/subprocess mock          | Assert the call occurred when it is part of the contract                                           |
| Saved config no longer equals the old one  | Assert which replacement was selected and whether it was persisted                                 |

Normalize only incidental values: temporary paths, platform/version display, ANSI escapes, and decorative padding when not under test. Preserve meaningful lines, values, diagnostics, and ordering guarantees. Do not normalize the field whose behavior the case is meant to prove.

Assert final file/store changes against an allowed set where side effects matter. Include unrelated-field preservation. Do not describe final byte equality as proof that a file was never rewritten.

## Failures, prompts, and concurrency

Separate warnings, collected validation errors, thrown failures, cancellation, and explicit timeouts. Record failure before versus after remote or local effects. A test must not pass because an unrelated error happened first.

PTY streams are merged: inspect `terminalOutput`, not fabricated isolated JSON stdout. Wait for visible prompt state, send text separately from Enter, and prefer waiting for the edited value over guessing that a fixed delay is enough. Keep finite deadlines and clean up the CLI, terminal wrapper, local servers, and scripted children.

Use `allowTimeout` only to characterize a known nonterminating path or an agreed long-running-command checkpoint. Assert that the intended phase was reached; do not treat a killed process as successful command completion.

Opt a suite into `describe.concurrent` only after its state is isolated. The command project uses `availableParallelism()` as its concurrency limit. In the installed Vitest version, workspace mode takes `sequence.concurrent` from the root and does not forward `--maxConcurrency` to projects. Use the standalone config for overrides:

```sh
pnpm exec vitest run --config test/vite.config.ts --maxConcurrency=4
```

Benchmark a few bounded limits rather than launching every CLI at once. Lower concurrency under contention; do not stretch behavioral timeouts merely to keep an overloaded run green.

## Validation

Run from the repository root, substituting the command's actual test path:

```sh
pnpm test test/app-info.test.ts --reporter=verbose
pnpm exec tsc -p test/tsconfig.json --noEmit
pnpm exec eslint test vite.config.ts --rule 'vitest/padding-around-test-blocks: error' --rule 'vitest/padding-around-describe-blocks: error'
pnpm exec prettier --check test
git diff --check
```

Confirm normal project discovery as well as focused runs. Inspect the diff and remaining processes. Keep unrelated changes intact. Test-only work does not need a public changeset.
