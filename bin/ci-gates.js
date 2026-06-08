// Single source of truth mapping every job in .github/workflows/tests-pr.yml to
// either a local `pre-ci` command (run-what-CI-runs) or an explicit reason it is
// CI-only. `bin/pre-ci.js` runs the pre-ci gates; `bin/check-ci-gates.js` asserts
// this list stays in sync with the workflow so the two cannot silently drift.
//
// `job` is the workflow job id (the key under `jobs:`), which is stable, unlike
// the rendered display name (matrix jobs interpolate `${{ ... }}`).
//
// pre-ci gates may declare:
//   command  — full-parity command (run by `pnpm pre-ci`)
//   affected — faster command for `pnpm pre-ci:affected` (defaults to `command`)
//   affectedWhen: 'codegen' — in affected mode, run only when the diff plausibly
//     changes generated output; otherwise skip with a reminder.

export const CI_GATES = [
  // --- gates a contributor can reproduce locally before pushing ---
  // Ordered as pre-ci should run them: build precedes the oclif codegen check,
  // and the graphql check precedes the oclif check (their whole-repo `git status`
  // asserts otherwise cross-contaminate in a single working tree).
  {job: 'type-check', kind: 'pre-ci', command: 'pnpm type-check', affected: 'pnpm type-check:affected'},
  {job: 'lint', kind: 'pre-ci', command: 'pnpm lint', affected: 'pnpm lint:affected'},
  {job: 'bundle', kind: 'pre-ci', command: 'pnpm build', affected: 'pnpm build:affected'},
  {job: 'knip', kind: 'pre-ci', command: 'pnpm knip'},
  {job: 'graphql-schema', kind: 'pre-ci', command: 'pnpm codegen:check:graphql', affectedWhen: 'codegen'},
  {job: 'oclif-checks', kind: 'pre-ci', command: 'pnpm codegen:check:oclif', affectedWhen: 'codegen'},
  {job: 'unit-tests', kind: 'pre-ci', command: 'pnpm test', affected: 'pnpm vitest run --changed origin/main'},

  // --- CI-only jobs, with the reason they are not part of pre-ci ---
  {
    job: 'unit-tests-gate',
    kind: 'ci-only',
    reason: 'Aggregation gate that only collects the unit-tests matrix results; nothing to run locally.',
  },
  {
    job: 'e2e-tests',
    kind: 'ci-only',
    reason: 'Needs Playwright browsers and real test stores/credentials; too slow and credentialed for a pre-push check.',
  },
  {
    job: 'type-diff',
    kind: 'ci-only',
    reason: 'Diffs the public type surface against the main branch; needs a base checkout, not a single local working tree.',
  },
  {
    job: 'major-change-check',
    kind: 'ci-only',
    reason: 'Breaking-change detection against the PR base; advisory and diff-based, not reproducible from one local tree.',
  },
  {
    job: 'ci-gate-sync',
    kind: 'ci-only',
    reason: 'Meta gate: runs `pnpm check-ci-gates` to keep this manifest in sync with tests-pr.yml. pre-ci runs the same check locally.',
  },
]

export const PRE_CI_GATES = CI_GATES.filter((gate) => gate.kind === 'pre-ci')
export const CI_ONLY_GATES = CI_GATES.filter((gate) => gate.kind === 'ci-only')
export const MANIFEST_JOB_IDS = CI_GATES.map((gate) => gate.job)
