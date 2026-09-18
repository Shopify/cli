import {
  APP_SCOPE,
  LOG_CHECK,
  SKIPPED_FILE,
  WEBHOOK_CHECK,
  WEB_SCOPE,
  agentResult,
  inventory,
  staticResult,
  suppressionFor,
  unresolvedStaticResult,
  webDescriptor,
} from './fixtures/interpretation.js'
import {CONFIGURATION_IDENTITY, scopeDescriptor} from './fixtures/result-contract.js'
import {AppDoctorInterpretationError, interpretAppDoctorResults} from '../interpretation/index.js'
import {describe, expect, test} from 'vitest'
import type {AppDoctorInterpretationInput} from '../interpretation/index.js'

const input = (overrides: Partial<AppDoctorInterpretationInput> = {}): AppDoctorInterpretationInput => ({
  configurationIdentity: CONFIGURATION_IDENTITY,
  results: [],
  inventory: inventory(),
  suppressions: [],
  ...overrides,
})

describe('interpretAppDoctorResults', () => {
  test('reports the mode outcome matrix with not_run for an absent mode', () => {
    const report = interpretAppDoctorResults(
      input({
        results: [
          staticResult({checkId: LOG_CHECK, findings: [{key: 'k'}]}),
          agentResult({checkId: LOG_CHECK}),
          staticResult({checkId: WEBHOOK_CHECK}),
          agentResult({scopeIdentity: WEB_SCOPE, checkId: WEBHOOK_CHECK}),
        ],
      }),
    )

    expect(report.basis).toBe('stored-results')
    expect(report.configurationIdentity).toBe(CONFIGURATION_IDENTITY)
    expect(
      report.checks.map((check) => [check.scopeIdentity, check.checkId, check.static.outcome, check.agent.outcome]),
    ).toEqual([
      [APP_SCOPE, LOG_CHECK, 'findings', 'clean'],
      [APP_SCOPE, WEBHOOK_CHECK, 'clean', 'not_run'],
      [WEB_SCOPE, WEBHOOK_CHECK, 'not_run', 'clean'],
    ])
  })

  test('a current scope with no results appears with empty checks and its reference', () => {
    const report = interpretAppDoctorResults(input({inventory: inventory([APP_SCOPE])}))

    expect(report.scopes).toEqual([
      {
        scopeIdentity: APP_SCOPE,
        current: true,
        reference: {base: 'storage_anchor', up: 0, path: '.'},
        descriptors: [],
        checks: [],
      },
    ])
    expect(report.checks).toEqual([])
    expect(report.findings).toEqual([])
    expect(report.score).toEqual({status: 'withheld', reason: 'no_static_results'})
  })

  test('a scope present only in results is reported as not current, without a reference', () => {
    const report = interpretAppDoctorResults(
      input({results: [staticResult({scopeIdentity: WEB_SCOPE})], inventory: inventory([APP_SCOPE])}),
    )

    expect(report.scopes.map((scope) => [scope.scopeIdentity, scope.current])).toEqual([
      [APP_SCOPE, true],
      [WEB_SCOPE, false],
    ])
    expect(report.scopes[1]).not.toHaveProperty('reference')
    expect(report.scopes[1]?.checks.map((check) => check.checkId)).toEqual([LOG_CHECK])
  })

  test('keeps every distinct descriptor observed for a scope with no winner', () => {
    const report = interpretAppDoctorResults(
      input({
        results: [
          staticResult({checkId: LOG_CHECK, descriptor: scopeDescriptor()}),
          staticResult({checkId: WEBHOOK_CHECK, descriptor: webDescriptor()}),
          agentResult({checkId: LOG_CHECK, descriptor: scopeDescriptor()}),
        ],
      }),
    )

    expect(report.scopes[0]?.descriptors).toEqual([scopeDescriptor(), webDescriptor()])
  })

  test('nests the same check objects under scopes as in the flat list', () => {
    const report = interpretAppDoctorResults(
      input({results: [staticResult({scopeIdentity: WEB_SCOPE}), staticResult({scopeIdentity: APP_SCOPE})]}),
    )

    expect(report.scopes.flatMap((scope) => scope.checks)).toEqual(report.checks)
  })

  test('assembles findings, score, coverage, and suppressions from stored evidence', () => {
    const scored = staticResult({findings: [{key: 'token-log', points: -30}]})
    const suppression = suppressionFor(scored.findings[0]?.fingerprint ?? '')
    const stale = suppressionFor(`sha256:${'e'.repeat(64)}`, 'stale')

    const report = interpretAppDoctorResults(input({results: [scored], suppressions: [suppression, stale]}))

    expect(report.findings).toHaveLength(1)
    expect(report.findings[0]?.suppressed).toBe(true)
    expect(report.score).toEqual({status: 'graded', total: 70, baseline: 100, grade: 'NEEDS_WORK'})
    expect(report.coverage.complete).toBe(true)
    expect(report.suppressions).toEqual({matched: 1, suppressedFindings: 1, unmatched: [stale]})
  })

  test('withholds the score when static coverage is incomplete', () => {
    const report = interpretAppDoctorResults(
      input({
        results: [
          staticResult({checkId: LOG_CHECK}),
          staticResult({
            checkId: WEBHOOK_CHECK,
            coverage: {files_skipped: [{path: SKIPPED_FILE, reason: 'unreadable'}]},
          }),
          unresolvedStaticResult({checkId: 'THIRD_CHECK'}),
        ],
      }),
    )

    expect(report.score).toEqual({status: 'withheld', reason: 'incomplete_static_coverage'})
    expect(report.coverage.gaps.map((gap) => [gap.code, gap.message])).toEqual([
      ['skipped_file', 'File could not be read.'],
      ['unresolved_check', 'THIRD_CHECK could not run.'],
    ])
    expect(report.checks.find((check) => check.checkId === 'THIRD_CHECK')?.static.outcome).toBe('unresolved')
  })

  test('throws for a result owned by another configuration', () => {
    const other = 'd'.repeat(32)
    expect(() => interpretAppDoctorResults(input({configurationIdentity: other}))).not.toThrow()
    expect(() => interpretAppDoctorResults(input({configurationIdentity: other, results: [staticResult()]}))).toThrow(
      AppDoctorInterpretationError,
    )
    expect(() => interpretAppDoctorResults(input({configurationIdentity: other, results: [staticResult()]}))).toThrow(
      expect.objectContaining({code: 'FOREIGN_CONFIGURATION'}),
    )
  })

  test('throws for a duplicate owner tuple', () => {
    const duplicate = () =>
      interpretAppDoctorResults(
        input({
          results: [
            staticResult({producedAt: '2026-09-16T12:00:00.000Z'}),
            staticResult({producedAt: '2026-09-17T12:00:00.000Z'}),
          ],
        }),
      )

    expect(duplicate).toThrow(AppDoctorInterpretationError)
    expect(duplicate).toThrow(expect.objectContaining({code: 'DUPLICATE_OWNER'}))
    // Different modes for one (scope, check) are distinct owners.
    expect(() => interpretAppDoctorResults(input({results: [staticResult(), agentResult()]}))).not.toThrow()
  })

  test('passes immediate diagnostics through in order and defaults to none', () => {
    const diagnostics = [
      {source: 'store' as const, code: 'UNREADABLE', message: 'Could not read a result.', path: 'results/x.json'},
      {source: 'scan' as const, code: 'PARTIAL', message: 'The scan stopped early.'},
    ]

    expect(interpretAppDoctorResults(input({diagnostics})).diagnostics).toEqual(diagnostics)
    expect(interpretAppDoctorResults(input()).diagnostics).toEqual([])
  })

  test('is deterministic and sorted regardless of input order', () => {
    const results = [
      agentResult({scopeIdentity: WEB_SCOPE, checkId: WEBHOOK_CHECK, findings: [{key: 'b'}, {key: 'a'}]}),
      staticResult({scopeIdentity: APP_SCOPE, checkId: WEBHOOK_CHECK, findings: [{key: 'z'}]}),
      staticResult({scopeIdentity: APP_SCOPE, checkId: LOG_CHECK, findings: [{key: 'y'}]}),
      staticResult({scopeIdentity: WEB_SCOPE, checkId: LOG_CHECK}),
    ]
    const first = interpretAppDoctorResults(input({results, inventory: inventory([WEB_SCOPE, APP_SCOPE])}))
    const second = interpretAppDoctorResults(
      input({results: [...results].reverse(), inventory: inventory([APP_SCOPE, WEB_SCOPE])}),
    )

    expect(second).toEqual(first)
    expect(first.scopes.map((scope) => scope.scopeIdentity)).toEqual([APP_SCOPE, WEB_SCOPE])
    expect(first.checks.map((check) => `${check.scopeIdentity}/${check.checkId}`)).toEqual([
      `${APP_SCOPE}/${LOG_CHECK}`,
      `${APP_SCOPE}/${WEBHOOK_CHECK}`,
      `${WEB_SCOPE}/${LOG_CHECK}`,
      `${WEB_SCOPE}/${WEBHOOK_CHECK}`,
    ])
    expect(first.findings.map((finding) => finding.scopeIdentity)).toEqual([APP_SCOPE, APP_SCOPE, WEB_SCOPE, WEB_SCOPE])
  })
})
