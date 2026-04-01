# Shopify CLI CI skills

This directory contains repo-local Agent Skills for Shopify CLI CI work:

- `cli-pre-submit-ci`
- `_shared/shopify-cli-ci-repo-contracts.md`

## Smoke-test harness

Use the local harness to check whether these skills are actually discovered and whether they steer behavior in the expected direction.

Harness:

```bash
scripts/test-cli-ci-skills.sh [scenario]
```

Scenarios:

- `pre-submit-current-branch` — current-branch pre-submit prompts
- `example-prs` — example PR prompts for pre-submit behavior across several diff families
- `all` — run both

Examples:

```bash
scripts/test-cli-ci-skills.sh pre-submit-current-branch
scripts/test-cli-ci-skills.sh example-prs
scripts/test-cli-ci-skills.sh all
```

## What the harness checks

The harness runs `pi -p` in this repo and reports whether it saw:

- the expected skill file being read
- key repo-inspection signals
- unexpected heavyweight execution in lightweight cases

A passing harness run means the skill was triggered and the interaction shape looked reasonable. It does **not** prove the repo change itself is correct.

## When to use it

Use the harness when you:

- change the pre-submit skill description or examples
- want to validate behavior against example Shopify CLI PRs
- want to confirm a lightweight docs/config/wiring PR stays lightweight
- want coverage across the current example diff families:
  - docs/config/wiring (`#7138`)
  - generated/codegen-sensitive changes (`#7133`)
  - workflow/CI-topology changes (`#7116`)
  - narrow test-only changes (`#7101`)

## Updating scenarios

If you add or change scenarios, keep them small and explicit:

- use prompts that reflect real user requests
- prefer stable example PRs when possible
- keep expected-signal matching focused on behavior, not exact prose
- treat heavyweight-command detection separately from file-reading detection
