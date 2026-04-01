# Shopify CLI CI repo contracts

Use this file for durable repo-specific guidance shared by the CLI CI skills.

## Principle

Resolve CI behavior from the repo’s current contract files before relying on memory or check names.

## Canonical sources

Read sources in this order:

1. `.github/workflows/*.yml`
2. `dev.yml`
3. `package.json`
4. helper scripts referenced by those files

For normal PR CI work, start with `.github/workflows/tests-pr.yml`.

## Stable repo facts

- CI is GitHub Actions.
- PR runs use workflow-level concurrency cancellation, so new pushes can cancel in-flight runs on the same branch.
- Some visible checks are aggregate or gate checks rather than the root cause.
- Generated outputs are often part of the required change set when a workflow step verifies cleanliness after regeneration.
- `dev.yml` is a useful local workflow entrypoint, but workflow YAML is the source of truth for what CI actually enforces.

## Gotchas

- Do not guess from a check name alone when the workflow or job definition is available.
- Treat cancelled runs as context, not strong evidence.
- Separate queue delay from actual execution time when judging slowness.
- Reproduce the workflow-equivalent generator or check locally before inventing a fix.
- Distinguish required generated churn from optional broad normalization churn.

## Examples

- A docs/manifests check may resolve through workflow steps into `package.json` scripts and then helper scripts under `bin/`.
- A visible `Unit tests` failure may be an aggregate failure caused by one matrix shard.
- A GraphQL freshness check may run a schema fetch step and a codegen step, then assert a clean git state.
