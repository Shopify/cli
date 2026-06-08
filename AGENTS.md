See @.cursor/rules/base.mdc for your desired behavior.
See @.cursor/rules/docs.mdc for Shopify CLI architecture and conventions.

# Working in Shopify CLI

Entry point for contributors and coding agents. It summarizes the pre-submit commands below and links to the canonical material: docs under [`docs/`](./docs/README.md), agent skills under [`.agents/skills/`](./.agents/skills).

## Before you push

- Run `pnpm pre-ci:affected` for a fast, diff-scoped pre-push check, or `pnpm pre-ci` for full CI parity before a high-risk push. The [`cli-pre-submit-ci`](./.agents/skills/cli-pre-submit-ci/SKILL.md) skill covers deriving the minimal set and what to stage.
- After changing commands, flags, or GraphQL queries, run `pnpm codegen` and commit the regenerated files.
- `pnpm check-ci-gates` keeps the local gate list ([`bin/ci-gates.js`](./bin/ci-gates.js)) and pinned tool versions in sync with the workflow.

## Key docs

- [Get started / setup and scripts](./docs/cli/get-started.md)
- [Local development against services](./docs/cli/local-development.md)
- [ESLint rules](./docs/cli/eslint-rules.md)
- [Testing strategy](./docs/cli/testing-strategy.md)
- [Cross-OS compatibility](./docs/cli/cross-os-compatibility.md)
- [Changesets and versioning](./CONTRIBUTING.md)
