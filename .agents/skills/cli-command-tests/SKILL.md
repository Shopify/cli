---
name: cli-command-tests
description: Write and strengthen Shopify CLI command-level Vitest tests. Use when given a command such as app info and asked to inventory its flags, network responses, TOML formats, files, stored state, and other inputs, then test observable behavior through the real CLI. Includes Git-history research, disk-backed fixtures, inline expectations, and a bounded coverage-guided validation loop.
compatibility: Requires the Shopify CLI repository, installed project dependencies, Node.js, pnpm, Git, and bash. Interactive tests also require the OS script utility. Source coverage uses the repository's c8-based mapping command.
---

# CLI command tests

Given a command, trace its inputs and write tests that prove its observable behavior. Follow the `test/app-info.test.ts` approach, including its inline expectations. Keep production behavior unchanged unless the user separately requests a fix.

## Start here

```text
/skill:cli-command-tests app info
```

Accept a command name or argv array. Treat it as data, not a shell program. Ask for the command if none was supplied. Use optional user-supplied scope, baseline, thresholds, and time budget; otherwise use these defaults:

- One command suite at `test/<command-slug>.test.ts`.
- Command-specific test documentation under `test/<command-slug>/`: `README.md` as the index, `coverage.md` for the behavior inventory, and focused profiles when the command needs them.
- New disk inputs at `test/fixtures/<command-slug>/<scenario>/project/`. Reuse an existing command catalog without renaming it.
- Proposed coverage targets: 90% lines, 80% branches, and 90% functions on the declared production-source scope, per file and in aggregate.
- At most three coverage-improvement rounds and 30 minutes of test/coverage iteration. Research and initial implementation are separate from that limit.

Confirm the source scope and targets in the plan. A percentage does not prove every behavior is tested. For commands that keep running, define a bounded lifecycle checkpoint before writing tests.

## Read the right references

| Need                                                                   | Read                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| Route every command through universal state and capability profiles    | [State catalog](references/state-catalog.md)   |
| App, web, and extension TOML shapes; history, contracts, and freshness | [Schema catalog](references/schema-catalog.md) |
| Fixture APIs, bash execution, meaningful assertions, and concurrency   | [Test standard](references/test-standard.md)   |
| Coverage provenance, thresholds, iteration, and stop conditions        | [Coverage loop](references/coverage-loop.md)   |

Read the state catalog and test standard for every command. From the state catalog, load the universal runtime/lifecycle references and each capability profile reached by the command. Read the schema catalog and relevant per-type pages when configuration files are reachable. Read the coverage loop before measuring coverage. Paths in backticks that start with `test/`, `docs/`, or `packages/` are relative to the repository root. Bundled links are relative to this skill directory.

Keep artifact ownership explicit:

- Put reusable cross-command state, schema, fixture, and coverage guidance in this skill's `references/` directory.
- Put command-specific input inventories, fixture matrices, characterized defects, output contracts, and coverage notes in `test/<command-slug>/`.
- Link the command profile from `test/<command-slug>/README.md` so readers can find each focused document.
- Keep expected values in the test file. A command profile explains the test design; it is not an output snapshot.
- Reserve `docs/` for product, contributor, and architecture documentation. Do not put test-planning artifacts there.

## 1. Establish the baseline and command boundary

1. Read repository instructions and `git status --short`. Preserve existing changes, including untracked files and lockfiles.
2. Record HEAD, relevant working-tree changes, CLI/Node versions, OS, and the exact argv prefix.
3. Locate the command, inherited flags, bootstrap, hooks, loader, services, and output functions. Read the actual call path rather than treating command help as the whole contract.
4. Read `test/README.md`, `test/<command-slug>/README.md` when present, the matching command suite, and the relevant support files before adding an abstraction.
5. Update the command profile as research changes the inventory. Create focused files only when they make `README.md` easier to scan.
6. Outline files to change, input families to cover, production-source coverage scope, and proposed thresholds before coding.

The shared process runner is reusable. `CommandFixture` is not yet a universal command fixture: it selects the app-information catalog and seeds app-info authentication, preferences, caches, and API responses. Adapt those defaults explicitly for another command. Do not give a theme or unauthenticated command an accidental app-info baseline.

Use direct execution by default. Delegate only when the user or project instructions authorize delegation.

## 2. Inventory flags, then network behavior

Start with flags and environment bindings:

- Include inherited flags, aliases, parser restrictions, help, and startup controls.
- Compare argv-only, env-only, both, absent, and invalid inputs where the command reads them.
- Record precedence and differences between early environment readers and the final parser.

Then trace network behavior:

- Identify each operation, method, endpoint, variables/body, authentication, cache, retry, timeout, and response consumer.
- Include device login, refresh, audience exchanges, follow-up requests, and lifecycle traffic.
- Define success, empty/missing data, malformed responses, authorization failures, retryable/nonretryable errors, and failures after mutations.
- List expected effects: rendered results, prompts, requests, credentials saved, files changed, and exit behavior.

Research can read public history and documentation. Test execution must use synthetic credentials and intercepted dependencies. Never use a developer's login state, create a real app, open a real browser, or run a real installer/deployer.

## 3. Inventory disk and remaining state

Use the catalogs as a starting set, not a mandate to multiply every dimension.

1. Trace project discovery, configuration selection, parsing, normalization, validation, and rendering separately.
2. Identify supporting files and installed exports actually read by this command.
3. Record stores, caches, environment, clock, terminal input, platform, and lifecycle hooks that can change an observable result.
4. Classify each catalog family as `applicable`, `read but ignored`, `not reached`, or `unresolved`, with source evidence.
5. Reuse verified history. Refresh the affected schema records when source or template history has changed.

A discovered file is not necessarily selected, validated, rendered, built, or deployed. Apply schema variants at the phases the target command reaches. An early error can still trigger metadata loading and local writes.

## 4. Turn the inventory into a test plan

For each behavior, record:

| Field    | Required information                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| ID       | Stable identifier, such as `flags.config.env-only`                                             |
| Evidence | Source path/symbol and relevant historical revision                                            |
| Input    | The smallest state change that selects this behavior                                           |
| Outcome  | Output/stream, exit, requests, prompts, file/store changes, and forbidden effects that matter  |
| Priority | High for credential handling, selection, destructive effects, result modes, or partial failure |
| Test     | Exact test name or table case; initially `planned`                                             |
| Status   | Planned, asserted, not applicable, or blocked, with a reason                                   |

Mark a row `asserted` only after its test passes and its assertions prove the named outcome. An executed line or an allowed mock is not an assertion. Record blocked and excluded rows; do not count them as covered.

Choose equivalence classes and boundary values. Combine dimensions only when their interaction changes behavior. Reuse a filesystem scenario when only flags, authentication, or network responses differ.

## 5. Write the tests

Apply the [test standard](references/test-standard.md). In particular:

- Run every action through bash and `packages/cli/bin/run.js`, with argv passed separately.
- Use real, isolated files and stores; block unregistered network and subprocess activity.
- Keep all expected values in the test or its adjacent parameter table. Keep helpers limited to setup, execution, observation, and normalization.
- Use `// GIVEN`, `// WHEN`, and `// THEN`. The first statement after `THEN` invokes the CLI; assertions follow.
- Leave a blank line between tests and describe blocks.
- Compare meaningful report/configuration values, diagnostics, generated declarations, and allowed side effects. Avoid large dumps of repeated internal metadata or decorative terminal borders.

Use distinct old/new tokens, app IDs, paths, and remote/local values when proving precedence or selection. Supply unsorted versions when proving sorting. Every test should fail for a plausible regression in its named behavior.

## 6. Validate and improve

First run focused tests, TypeScript, lint, formatting, and diff checks. Then run the full command suite with the normal repository invocation. Verify that setup, source fixtures, and child processes are cleaned up.

Review the tests before chasing a percentage:

- Can an unrelated failure satisfy a negative test?
- Does a mode test check its actual payload and stream, not merely nonempty output?
- Does a retry test prove the correct credential and request, not only a count?
- Does a generated-file test prove the retained type, not merely the absence of another type?
- Does an existing case already cover the same inputs and outcome?

Run the bounded [coverage loop](references/coverage-loop.md). Use `pnpm test:commands:coverage` to run the suite, map spawned-process coverage, and check thresholds. Use `pnpm test:commands:coverage:check` only when checking an existing mapped summary. Keep the source scope fixed. Add tests for meaningful uncovered behavior, not incidental initialization. If mapping fails verification, report that blocker and finish the behavioral checks without inventing a coverage percentage.

When an expectation fails, check the executed path and fixture before changing it. Correct an expectation only with source/runtime evidence. Label confirmed defects as characterizations; leave production fixes for a separate request.

Keep the agreed targets and deadlines. Do not remove meaningful assertions, add coverage-ignore annotations, or hide overload to make a run pass.

## Completion report

Report the command and baseline, changed test/fixture files, checks and results, coverage scope/provider/percentages, and remaining gaps. State whether the result is:

- **Complete for the agreed scope:** tests and quality checks pass, applicable planned behavior is asserted, and the coverage gate passes if required.
- **Behavior validated; coverage blocked:** tests pass, but usable source coverage is unavailable or incomplete.
- **Incomplete:** behavior gaps, failing checks, or unmet targets remain after the iteration budget.

A passing suite does not establish every historical format or platform. Name the limits. Keep expectations inline and dependencies isolated.
