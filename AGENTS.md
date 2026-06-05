See @.cursor/rules/base.mdc for your desired behavior.
See @.cursor/rules/docs.mdc for Shopify CLI architecture and conventions.

# Working in Shopify CLI

Guidance for contributors and coding agents to get a change green in CI with the fewest round-trips. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for changesets/versioning and [`docs/LOCAL_DEV.md`](./docs/LOCAL_DEV.md) for running the CLI locally.

## Before you push: `pnpm pre-ci`

Run the local subset of the PR pipeline before pushing:

```bash
pnpm pre-ci      # or: dev pre-ci
```

It runs, in CI-parity order: `type-check`, `lint`, `build`, `knip`, the graphql and OCLIF/docs codegen freshness checks, and unit tests — and prints which CI-only gates it skips (e2e, type-diff, breaking-change detection) and why. It mirrors CI's full targets, so green locally implies green in CI; it is slower than the affected-only `dev check`.

The gate list lives in [`bin/ci-gates.js`](./bin/ci-gates.js) and is kept in sync with `.github/workflows/tests-pr.yml` by `pnpm check-ci-gates` (enforced by the `CI gate manifest` CI job). When you add or change a CI gate, update that manifest.

## After changing commands, flags, or GraphQL queries: `pnpm codegen`

Generated files are gated in CI (`Check OCLIF manifests & readme & docs`, `Check graphql-codegen has been run`). Regenerate and commit them:

```bash
pnpm codegen                 # regenerate everything
pnpm codegen:check:oclif     # regenerate + verify the tree is clean (as CI does)
pnpm codegen:check:graphql
```

## Linting

Use the repo's lint command, not `eslint` directly:

```bash
pnpm lint        # nx-driven; matches the CI "Lint" job
pnpm lint:fix    # auto-fix
```

Invoking `eslint <file>` directly can report problems CI does not enforce (and CI lints project sources, not root `bin/` scripts). Repo-specific lint conventions are implemented in [`packages/eslint-plugin-cli/rules/`](./packages/eslint-plugin-cli/rules) (for example, `no-vi-manual-mock-clear` — Vitest resets mocks automatically, so do not clear them by hand). Check there when a rule is unfamiliar rather than guessing.

## Tests

```bash
pnpm test                              # full vitest run (single env; CI runs a node/OS matrix)
pnpm vitest run path/to/file.test.ts   # a single file
```
