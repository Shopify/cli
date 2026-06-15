---
name: cli-pre-submit-ci
description: 'Prevent predictable Shopify CLI PR CI failures before push or submit. Use when users: (1) ask what to run before pushing, submitting, restacking, opening, or updating a PR, (2) ask which generated files to commit or stage, (3) want to validate a branch against GitHub Actions, or (4) want to avoid CI churn after command, docs, workflow, schema, or test changes. At PR time, default to suggesting the minimal pre-submit checks rather than running a full local workflow automatically.'
---

# CLI pre-submit CI

Start with the shared repo facts in [`../_shared/shopify-cli-ci-repo-contracts.md`](../_shared/shopify-cli-ci-repo-contracts.md).

## Principle

Derive the smallest sufficient pre-submit validation set from the current CI contract. Do not guess, and do not default to the broadest possible local run.

## Pattern

### 1) Classify the diff first
Start by inspecting both the branch diff and the current working tree.

Use one consistent branch-diff command rather than rediscovering it each time.

Example:

```bash
git diff --name-only $(git merge-base HEAD origin/main)...HEAD
git status --short
```

Treat these as different scopes:
- branch diff vs `origin/main` = what the PR currently changes
- working tree status = what the user might still push next

If the diff clearly maps to a narrow family, keep the investigation narrow.

| Diff class | Default response |
|---|---|
| docs/config/wiring only, with no obvious workflow-enforced generator family | **stop there unless contradicted**: run lightweight sanity checks only (`git diff --check`, validate changed symlink targets, validate local markdown links if relevant); do not full-read large workflow/script files |
| user is at PR time (`submit`, `open`, `update`, `restack`) | advisory mode: suggest minimal checks, staging needs, and likely CI risk; ask before running anything substantial |
| user asks what to run before push | recommend the minimal high-signal checks implied by the workflow |
| user asks what to commit or stage | reproduce the relevant generator/check path, then inspect git status and diffs |
| user explicitly asks to run checks | run the minimal derived set, not the whole world |

### 2) Resolve the contract for the relevant family
Only do this if the diff class suggests a real CI-family mapping, or if the user asks for broader confidence.

Read sources in this order:

1. relevant `.github/workflows/*.yml`
2. `dev.yml`
3. `package.json`
4. helper scripts referenced by those files

For normal PR work, start with `.github/workflows/tests-pr.yml`.

Read only the files and script sections needed for the diff class you identified. Avoid full reads of large files for docs/config/wiring-only diffs.

### 3) Map the diff to contract families

| Change shape | Inspect first | Likely response |
|---|---|---|
| Command/flag/help surface | docs/manifests/readme freshness jobs | derive the generator path from workflow → scripts |
| GraphQL queries or schemas | schema/codegen freshness jobs | derive the schema fetch + codegen path |
| TypeScript implementation or exports | type-check, lint, knip, bundle jobs | focused tests plus required static checks |
| Test helpers, async UI, network/auth/callback logic | unit-test jobs and nearby tests | focused tests plus a CI-risk warning |
| Workflow files or CI plumbing | affected workflow definitions | validate the changed contract directly |

### 4) Finish with staging guidance
After any generator, freshness check, or lightweight sanity pass:

1. inspect `git status --short`
2. inspect targeted diffs
3. say which files look like:
   - required generated output
   - optional broad churn worth review
   - suspicious changes suggesting the wrong or incomplete generation path

## Gotchas

- At PR time, do **not** automatically run the full workflow-equivalent validation set unless the user asks.
- `dev.yml` is a useful local entrypoint, but workflow YAML is the source of truth for what CI enforces.
- Broad generated diffs are not automatically wrong; distinguish required churn from suspicious churn.
- Do not stop at “run this command.” Explain what likely needs staging.
- If the diff is docs/config/wiring only, do not escalate to heavyweight checks unless the workflow or the user gives a reason.
- For docs/config/wiring-only diffs, avoid full reads of large workflow or script files unless the diff clearly maps to an enforced CI family.
- If the change touches async/timing-heavy tests, local servers, callback flows, socket teardown, or workflow topology, warn that CI-only failures may still appear even after local checks pass.

## Examples

- "What should I run before I push this PR?" → derive the minimal checks from workflow → `dev.yml` → `package.json`, then recommend focused tests plus any required generators.
- "Submit this PR." → treat it as a pre-submit moment, suggest the minimal recommended checks and likely staging requirements first, and ask before running them.
- "Which generated files do I need to commit?" → reproduce the relevant generation path, inspect git status, and separate required generated output from optional churn.
- "I changed a command flag; what repo checks matter?" → start from the freshness job that enforces command-surface updates rather than from memory.
