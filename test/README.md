<!--
title: cli_command_tests
description: How to run, extend, and validate command-level CLI tests.
tags: [documentation, testing, cli, vitest]
-->

# CLI command tests

The tests in this directory execute the real CLI end to end through bash. They use isolated fixture directories, intercepted network requests, and real persistent stores. Each test file targets one command.

## Run

```sh
pnpm exec vitest run --project commands --reporter=verbose
```

## Test structure

```ts
test('uses a saved configuration', async ({fixture}) => {
  // GIVEN
  await fixture.reserve('named-staging-fixture')
  await fixture.seedState({appPreferences: {configFile: 'shopify.app.staging.toml'}})

  // WHEN
  const command = ['app', 'info', '--json']

  // THEN
  const result = await fixture.runShopifyCommand(command)
  expect(result.exitCode, result.stderr).toBe(0)
  expect(result.stderr).toBe('')

  const report = JSON.parse(result.stdout)
  expect(report).toMatchObject({
    directory: fixture.projectPath,
    configuration: {
      client_id: 'synthetic-client-id',
      name: 'Staging fixture',
      application_url: 'https://fixture.example.test',
      embedded: true,
      access_scopes: {scopes: 'read_products'},
    },
    organization: {id: '123', businessName: 'Fixture organization'},
  })
  expect(result.requests.map(({operation}) => operation)).toEqual([
    'UserInfo',
    'ActiveAppReleaseFromApiKey',
    'FindOrganization',
    'fetchSpecifications',
  ])
  expect((await fixture.readStore('app'))[fixture.projectPath]).toMatchObject({
    configFile: 'shopify.app.staging.toml',
    title: 'Remote fixture',
    orgId: '123',
  })
})
```

`GIVEN` prepares state. `WHEN` prepares the invocation. As requested, `THEN` starts by running the command, followed by assertions. `test.for` supplies table-driven cases and the per-test `fixture` together.

## Fixture and command boundary

`support/fixture.ts` creates a private sandbox and isolated home/store directories for every case. Vitest owns cleanup, including after failures. There are no automatically generated app files: every test reserves a filesystem scenario before running a command.

`fixture.reserve(name)` copies `test/fixtures/app-information/<name>/` into the sandbox. Each scenario has a `project/` directory and can include ancestor inputs beside it. The copy is independent, writable, and reserved once per test. Cleanup checks that the source bytes, symlinks, modes, and modification times have not changed. Repeated commands reuse that copy; other tests can reserve the same source concurrently without sharing state. Relative symlinks are preserved, escaping symlinks are rejected, and source fixtures are never modified.

The harness initializes a usable synthetic user session, empty app preferences, controlled lifecycle caches/preferences, and four baseline linked-app network mocks. Those defaults are separate from the reserved filesystem. Tests change them through the APIs below. UI scenarios contain synthetic installed-package files, so a developer's dependencies cannot supply missing exports.

`fixture.runShopifyCommand(['app', 'info', ...flags])` starts:

```sh
bash --noprofile --norc -c 'exec shopify "$@"' command-test app info ...
```

A fixture-local `shopify` shim runs Node with the test network preload and the repository's actual `packages/cli/bin/run.js`. Arguments are passed separately, never interpolated into shell source. Every invocation gets a fresh process, including cache-reuse tests that deliberately retain the fixture's disk state.

The helper captures stdout, stderr, exit code, signal, request events, and before/after project and fixture-root snapshots. Root snapshots include home/store/framework/temp files, but exclude the harness's protocol files, launch shim, and dependency-resolution guard. Symlink targets are recorded without following them. Tests inspect persistent stores and generated files separately. The usual text report goes to stderr; JSON and web-env results go to stdout. A warning, a collected error followed by exit 2, and a thrown error before reporting are different outcomes.

## Output expectations

Expected outputs are inline in `app-info.test.ts`: explicit objects for JSON/configuration values, multiline strings for text reports and generated declarations, and diagnostics in the relevant test tables. Only filesystem inputs live in fixture directories; there are no external output snapshots or automatic snapshot updates.

`support/observations.ts` normalizes exact temporary paths, including paths wrapped by Ink, and the current Node/platform values. It removes ANSI escapes, box borders, column padding, and repeated blank lines while preserving report content and paragraphs. Expectations remain in the tests, not in this helper.

JSON assertions cover configuration, project metadata, web components, extension identity/targets/metafields, and schema omission. They deliberately do not freeze every duplicated internal extension/specification object or deploy-step manifest. Generated declarations retain complete inline comparisons, without redundant substring checks.

Root snapshots are compared against explicit allowed changes for ordinary reporting, forced linking, parser/auth failures, and generated-file failures. In particular, an early failure does not always mean no writes: error-metadata loading can create `.shopify` files. These are final-state assertions, not filesystem write-event tracing.

## Fixture API

| API                                                                                        | Purpose                                                                                                           |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `reserve(name)`                                                                            | Copy one complete filesystem scenario; no baseline app-file overlay or fixture inheritance.                       |
| `seedState({authentication, appPreferences, cliPreferences, caches})`                      | Write real persistent state at platform-specific store paths.                                                     |
| `configure({environment, cwd, clock, requestLimit, loopbackPorts})`                        | Configure runtime inputs and explicit harness limits. Environment keys set to `undefined` are unset in the child. |
| `mockNetwork(...)`                                                                         | Register complete request/response fixtures, or override one existing GraphQL mock by operation.                  |
| `mockSubprocess(...)`                                                                      | Script an expected external process and its outcome; never run the real browser or installer.                     |
| `runShopifyCommand(argv, options)`                                                         | Execute the full argument vector through bash, optionally using a PTY.                                            |
| `path(relative)`, `projectPath`, `root`                                                    | Locate paths in the reserved project or its containing sandbox.                                                   |
| `readFile(relative)`, `readStore('app' \| 'cli-kit')`                                      | Read UTF-8 text from the copy or the store's raw parsed JSON.                                                     |
| `writeFile(relative, contents)`, `writeFileAt(absolute, contents)`, `removeFile(relative)` | Escape hatches for runtime-dependent inputs and between-command changes. Writes are confined to the sandbox.      |

Static TOML, JSON, source, locale, and dependency bytes belong in the filesystem catalog. The two loopback tests still use `writeFile()` because their schema URLs contain a port allocated at runtime. Timestamps applied between invocations also remain runtime operations.

## Coverage

Run the app-info suite, map spawned-process V8 coverage to TypeScript sources, and check the configured thresholds with one command:

```sh
pnpm test:commands:coverage
```

The command writes its artifacts under `coverage/commands/app-info/`:

- `raw/` contains the scoped V8 reports from each CLI process.
- `report/coverage-summary.json` contains the mapped Istanbul summary.
- `test/app-info/coverage-scope.json` defines the source files and thresholds.

A nonzero exit after the tests pass means the coverage report is valid but misses a threshold. The current pilot exits 1 because `services/app/env/show.ts` does not meet its per-file line and function targets; see the [coverage checklist](./app-info/coverage.md). For a pipeline check without the full suite, pass a test name:

```sh
pnpm test:commands:coverage --test-name 'prints remote identity and local configuration'
```

A focused run is diagnostic evidence, not command-wide coverage. To check an existing mapped summary without rerunning tests, use:

```sh
pnpm test:commands:coverage:check \
  test/app-info/coverage-scope.json \
  coverage/commands/app-info/report/coverage-summary.json
```

Forced-kill cases might not flush V8 data. The runner reports the number of coverage files it maps and keeps the raw reports for inspection.
