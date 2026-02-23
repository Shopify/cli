# Branching and Review Strategy

## Tools

- **Graphite** for stacked PRs (sequential dependencies within a phase)
- **GitHub PRs** for independent branches (parallel work across batches)
- All branches target `main`

## Naming Convention

```
appmodule/phase-{N}/{description}
```

Examples:
- `appmodule/phase-1/base-class-and-config-modules`
- `appmodule/phase-1/integration-points`
- `appmodule/phase-2/batch-1-checkout-theme-channel`
- `appmodule/phase-2/batch-3-flow-action`
- `appmodule/phase-3/pr1-new-files`
- `appmodule/phase-3/pr2-test-factory`

## Phase 1: 2 Independent PRs

Phase 1 is small enough that a Graphite stack is optional. Two independent PRs off `main`:

| PR | Branch | Contents | Dependencies |
|----|--------|----------|-------------|
| 1 | `appmodule/phase-1/base-class-and-config-modules` | AppModule base class, 9 config modules, app-modules/index.ts, all unit + parity tests | None |
| 2 | `appmodule/phase-1/integration-points` | Loader wiring, deployConfig routing, select-app decode, json-schema category error fix, regression test | PR 1 merged |

PR 1 is purely additive (new files only). PR 2 modifies 4 existing files.

**Review:** Each PR needs 1 reviewer familiar with the app loading/deploy flow. PR 2 should be reviewed by someone who understands the access_scopes incident context.

**Alternative:** If preferred, Phase 1 can be a single Graphite stack of 2 PRs for atomic review:
```bash
gt create -m "AppModule base class + 9 config modules"
# ... commit new files ...
gt create -m "Wire integration points (loader, deployConfig, select-app, json-schema)"
# ... commit integration changes ...
gt submit
```

## Phase 2: 1 Stack + Parallel Branches

Phase 2 has 5 batches. Batch 1 must merge first (establishes the pattern). Batches 2-5 are independent.

### Batch 1: Graphite Stack (sequential, pattern-setting)

```bash
gt create appmodule/phase-2/batch-1-checkout-post-purchase
gt create appmodule/phase-2/batch-1-theme
gt create appmodule/phase-2/batch-1-channel-config
gt submit
```

Or, since Batch 1 is 3 trivial modules, a single PR is also fine:

| PR | Branch | Contents |
|----|--------|----------|
| 1 | `appmodule/phase-2/batch-1` | checkout_post_purchase, theme, channel_config modules + parity tests |

### Batches 2-5: Independent Branches off `main` (after Batch 1 merges)

These can all be opened simultaneously and reviewed in parallel:

| PR | Branch | Contents | Parallelizable With |
|----|--------|----------|-------------------|
| 2 | `appmodule/phase-2/batch-2-web-pixel` | web_pixel module | All batch 2-5 PRs |
| 3 | `appmodule/phase-2/batch-2-checkout-ui` | checkout_ui module | All batch 2-5 PRs |
| 4 | `appmodule/phase-2/batch-2-tax-calc` | tax_calculation module | All batch 2-5 PRs |
| 5 | `appmodule/phase-2/batch-2-marketing` | marketing_activity module | All batch 2-5 PRs |
| 6 | `appmodule/phase-2/batch-3-flow-action` | flow_action module | All batch 2-5 PRs |
| 7 | `appmodule/phase-2/batch-3-flow-trigger` | flow_trigger module | All batch 2-5 PRs |
| 8 | `appmodule/phase-2/batch-3-flow-template` | flow_template module | All batch 2-5 PRs |
| 9 | `appmodule/phase-2/batch-3-pos-ui` | pos_ui_extension module | All batch 2-5 PRs |
| 10 | `appmodule/phase-2/batch-3-product-sub` | product_subscription module | All batch 2-5 PRs |
| 11 | `appmodule/phase-2/batch-3-editor-ext` | editor_extension_collection module | All batch 2-5 PRs |
| 12 | `appmodule/phase-2/batch-4-payments` | payments_app_extension (6 variants) | All batch 2-5 PRs |
| 13 | `appmodule/phase-2/batch-5-ui-extension` | ui_extension (5 capability methods) | All batch 2-5 PRs |

Each PR touches only:
1. One new file: `app-modules/<module>.ts`
2. One new test file: `app-modules/<module>.test.ts`
3. One line added to: `app-modules/index.ts`

The only shared file is `index.ts`. Since changes are additive (appending to an array), merge conflicts are trivially resolvable with `gt restack`.

**Review:** Each module PR can be reviewed independently. Reviewer just needs to verify:
- encode() output matches old spec.deployConfig() (parity test passes)
- Module is registered in index.ts
- No other files modified

**Grouping option:** If 13 separate PRs feels like too much overhead, batch PRs can group 2-3 modules each. The key constraint is that each PR must only add new files + the index.ts registration.

## Phase 3: Graphite Stack (5 Sequential PRs)

Phase 3 has strict sequential dependencies. This is the primary use case for Graphite stacking.

```bash
# Create the stack
gt create appmodule/phase-3/pr1-new-files -m "Create ModuleInstance, TomlFile, ProjectLayout, loading functions"
# ... commit step 1 ...

gt create appmodule/phase-3/pr2-test-factory -m "Update test data factory to produce ModuleInstance"
# ... commit step 3 (factory parity verification + factory replacement) ...

gt create appmodule/phase-3/pr3-app-class-loader -m "Update App class + loader to use ModuleInstance"
# ... commit steps 4 + 6 ...

gt create appmodule/phase-3/pr4-type-replacements -m "Batch type-import replacements (55+ files)"
# ... commit steps 5 + 7 + 8 ...

gt create appmodule/phase-3/pr5-remove-aliases -m "Remove compatibility aliases"
# ... commit step 9 ...

# Submit the entire stack for review
gt submit
```

### Stack Review Strategy

Graphite shows each PR's diff independently, even though they're stacked. Reviewers can:
1. Review PR 1 (low risk, additive) -> approve and merge
2. Review PR 2 (high risk, factory changes) -> this is the critical review
3. Review PR 3 (medium risk, loader + App class) -> second most important
4. Review PR 4 (low risk, mechanical replacements) -> can be approved quickly
5. Review PR 5 (low risk, cleanup) -> can be approved quickly

**Important Graphite workflow notes:**
- After PR 1 merges, run `gt restack` to rebase the remaining stack onto updated `main`
- If PR 2 needs changes after review, update it and run `gt submit` to re-push the entire stack
- Each PR must pass CI independently (Graphite enforces this)
- If a reviewer requests changes to PR 3 that affect PR 4, update both and `gt submit`

### Rollback with Graphite

If a merged PR causes issues:
- Graphite PRs are standard GitHub PRs -- revert with `gh pr revert`
- If PR 3 needs reverting, PRs 4-5 must also be reverted (or the stack unwound)
- PR 1 and PR 2 can be reverted independently since they only add new files / change test factories

## Cross-Phase Dependencies

```
Phase 1 PR 1 --> Phase 1 PR 2 --> Phase 2 Batch 1 --> Phase 2 Batches 2-5 --> Phase 3 Stack
                                                        (parallel)              (sequential)
```

Each phase gate:
- **Phase 1 -> Phase 2:** Phase 1 PR 2 must be merged. Verify: `allAppModules` contains 9 config modules, all 4 integration points wired.
- **Phase 2 -> Phase 3:** ALL Phase 2 PRs must be merged. Verify: every spec identifier has a corresponding AppModule (the CI check from phase-3-steps.md Section 1.0 enforces this).

## Review Assignments

| Phase | Reviewers | Focus |
|-------|-----------|-------|
| Phase 1 | 1 senior engineer familiar with loader/deploy flow | Correctness of integration points, regression test quality |
| Phase 2 (per module) | 1 engineer (any level) | Parity test passes, encode matches old deployConfig |
| Phase 3 PR 1 | 1 engineer | New class structure, compatibility shim completeness |
| Phase 3 PR 2 | 2 engineers (one familiar with test patterns) | Factory output parity, no test semantic changes |
| Phase 3 PR 3 | 2 engineers (one familiar with loader.ts) | Loader migration correctness, App class type changes |
| Phase 3 PR 4 | 1 engineer | Mechanical verification (grep for remaining ExtensionInstance refs) |
| Phase 3 PR 5 | 1 engineer | Confirm all old names removed, no remaining compatibility aliases |

## CI Requirements

Every PR must pass:
1. `npx tsc --noEmit --project packages/app/tsconfig.json` (type check)
2. `npx vitest run packages/app/` (full app test suite)
3. `npx eslint packages/app/src/` (lint)

Phase 3 PRs additionally must pass:
4. `grep -r "ExtensionInstance" packages/app/src/cli/ --include="*.ts" | grep -v extension-instance.ts | grep -v node_modules` -- should return decreasing results with each PR, and zero after PR 5.
