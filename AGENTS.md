See @.cursor/rules/base.mdc for your desired behavior.
See @.cursor/rules/docs.mdc for Shopify CLI architecture and conventions.

# Working in Shopify CLI

Entry point for contributors and coding agents. Canonical docs live under [`docs/`](./docs/README.md) and agent skills under [`.agents/skills/`](./.agents/skills); this file routes to them rather than restating them.

## Before you push

- Derive the minimal checks for your diff with the [`cli-pre-submit-ci`](./.agents/skills/cli-pre-submit-ci/SKILL.md) skill. For full local CI parity (slower), run `pnpm pre-ci`.
- After changing commands, flags, or GraphQL queries, run `pnpm codegen` and commit the regenerated files.
- `pnpm check-ci-gates` keeps the local gate list ([`bin/ci-gates.js`](./bin/ci-gates.js)) and pinned tool versions in sync with the workflow.

## Key docs

- [Get started / setup and scripts](./docs/cli/get-started.md)
- [Local development against services](./docs/cli/local-development.md)
- [ESLint rules](./docs/cli/eslint-rules.md)
- [Testing strategy](./docs/cli/testing-strategy.md)
- [Cross-OS compatibility](./docs/cli/cross-os-compatibility.md)
- [Changesets and versioning](./CONTRIBUTING.md)
