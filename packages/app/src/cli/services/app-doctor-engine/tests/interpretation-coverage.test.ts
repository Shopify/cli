import {
  APP_SCOPE,
  LOG_CHECK,
  RUBY_FILE,
  SKIPPED_FILE,
  WEBHOOK_CHECK,
  WEB_SCOPE,
  agentResult,
  staticResult,
  unresolvedStaticResult,
} from './fixtures/interpretation.js'
import {interpretAppDoctorCoverage, interpretAppDoctorChecks} from '../interpretation/coverage.js'
import {describe, expect, test} from 'vitest'

const skipped = (path: string) => ({path, reason: 'too_large' as const, size_bytes: 5_000_000})

describe('interpretAppDoctorCoverage', () => {
  test('no static results is incomplete with empty lists', () => {
    expect(interpretAppDoctorCoverage([agentResult()])).toEqual({
      staticResultCount: 0,
      complete: false,
      filesSkipped: [],
      unsupportedLanguages: [],
      gaps: [],
      owners: [],
    })
  })

  test('clean static results are complete', () => {
    const coverage = interpretAppDoctorCoverage([staticResult({checkId: 'A'}), staticResult({checkId: 'B'})])
    expect(coverage.staticResultCount).toBe(2)
    expect(coverage.complete).toBe(true)
    expect(coverage.gaps).toEqual([])
  })

  test('a skipped file duplicated across two owners is reported once, keeping the first observation', () => {
    const first = staticResult({
      checkId: 'A_CHECK',
      coverage: {files_skipped: [{...skipped(SKIPPED_FILE), detail: 'first'}]},
    })
    const second = staticResult({
      checkId: 'B_CHECK',
      coverage: {files_skipped: [{...skipped(SKIPPED_FILE), detail: 'second'}]},
    })

    const coverage = interpretAppDoctorCoverage([first, second])

    expect(coverage.complete).toBe(false)
    expect(coverage.filesSkipped).toEqual([{...skipped(SKIPPED_FILE), detail: 'first'}])
    expect(coverage.gaps).toEqual([
      {code: 'skipped_file', message: 'File exceeded the size limit.', file: SKIPPED_FILE},
    ])
  })

  test('unsupported languages merge by name with a sorted union of files', () => {
    const first = staticResult({
      checkId: 'A_CHECK',
      coverage: {unsupported_languages: [{name: 'ruby', files: [RUBY_FILE, 'anchor/0/app/legacy/z.rb']}]},
    })
    const second = staticResult({
      checkId: 'B_CHECK',
      coverage: {unsupported_languages: [{name: 'ruby', files: ['anchor/0/app/legacy/a.rb', RUBY_FILE]}]},
    })

    const coverage = interpretAppDoctorCoverage([second, first])

    expect(coverage.unsupportedLanguages).toEqual([
      {name: 'ruby', files: ['anchor/0/app/legacy/a.rb', RUBY_FILE, 'anchor/0/app/legacy/z.rb']},
    ])
    expect(coverage.gaps).toEqual([{code: 'unsupported_language', message: 'ruby sources are not analysed.'}])
  })

  test('unresolved_check gaps stay owner-local and are never merged across owners', () => {
    const results = [
      unresolvedStaticResult({scopeIdentity: WEB_SCOPE, checkId: LOG_CHECK}),
      unresolvedStaticResult({scopeIdentity: APP_SCOPE, checkId: LOG_CHECK}),
    ]

    const coverage = interpretAppDoctorCoverage(results)

    expect(coverage.gaps).toEqual([
      {
        code: 'unresolved_check',
        message: `${LOG_CHECK} could not run.`,
        owner: {scopeIdentity: APP_SCOPE, checkId: LOG_CHECK},
      },
      {
        code: 'unresolved_check',
        message: `${LOG_CHECK} could not run.`,
        owner: {scopeIdentity: WEB_SCOPE, checkId: LOG_CHECK},
      },
    ])
    expect(coverage.complete).toBe(false)
  })

  test('owners carry per-owner counts and no total is ever summed', () => {
    const results = [
      staticResult({scopeIdentity: WEB_SCOPE, checkId: 'A_CHECK', coverage: {files_scanned: 7}}),
      staticResult({
        scopeIdentity: APP_SCOPE,
        checkId: 'B_CHECK',
        coverage: {files_scanned: 7, files_skipped: [skipped(SKIPPED_FILE)]},
      }),
      staticResult({scopeIdentity: APP_SCOPE, checkId: 'A_CHECK', coverage: {files_scanned: 7}}),
    ]

    const coverage = interpretAppDoctorCoverage(results)

    expect(coverage.owners).toEqual([
      {scopeIdentity: APP_SCOPE, checkId: 'A_CHECK', filesScanned: 7, gapCount: 0},
      {scopeIdentity: APP_SCOPE, checkId: 'B_CHECK', filesScanned: 7, gapCount: 1},
      {scopeIdentity: WEB_SCOPE, checkId: 'A_CHECK', filesScanned: 7, gapCount: 0},
    ])
    expect(JSON.stringify(coverage)).not.toContain('21')
    expect(Object.keys(coverage).sort()).toEqual([
      'complete',
      'filesSkipped',
      'gaps',
      'owners',
      'staticResultCount',
      'unsupportedLanguages',
    ])
  })
})

describe('interpretAppDoctorChecks', () => {
  test('reports both modes for every owner, with not_run for an absent mode', () => {
    const staticLog = staticResult({checkId: LOG_CHECK, findings: [{key: 'k'}], checkVersion: 4})
    const agentWebhook = agentResult({checkId: WEBHOOK_CHECK})
    const agentWebLog = agentResult({scopeIdentity: WEB_SCOPE, checkId: LOG_CHECK, findings: [{key: 'k'}, {key: 'j'}]})

    const checks = interpretAppDoctorChecks([agentWebLog, agentWebhook, staticLog])

    expect(checks).toEqual([
      {
        scopeIdentity: APP_SCOPE,
        checkId: LOG_CHECK,
        static: {outcome: 'findings', producedAt: staticLog.produced_at, checkVersion: 4, findingCount: 1},
        agent: {outcome: 'not_run'},
      },
      {
        scopeIdentity: APP_SCOPE,
        checkId: WEBHOOK_CHECK,
        static: {outcome: 'not_run'},
        agent: {
          outcome: 'clean',
          producedAt: agentWebhook.produced_at,
          checkVersion: 3,
          findingCount: 0,
          guidance: agentWebhook.execution.guidance,
          promptHash: agentWebhook.prompt_hash,
        },
      },
      {
        scopeIdentity: WEB_SCOPE,
        checkId: LOG_CHECK,
        static: {outcome: 'not_run'},
        agent: {
          outcome: 'findings',
          producedAt: agentWebLog.produced_at,
          checkVersion: 3,
          findingCount: 2,
          guidance: agentWebLog.execution.guidance,
          promptHash: agentWebLog.prompt_hash,
        },
      },
    ])
  })

  test('an unresolved static result reports its reason and guidance', () => {
    const [check] = interpretAppDoctorChecks([unresolvedStaticResult()])

    expect(check?.static).toEqual({
      outcome: 'unresolved',
      producedAt: '2026-09-16T12:00:00.000Z',
      checkVersion: 3,
      findingCount: 0,
      reason: {code: 'parser_unavailable', message: 'The TypeScript parser is unavailable.'},
      guidance: 'Install the parser and rerun the scan.',
    })
  })

  test('clean static and clean agent outcomes are independent', () => {
    const [check] = interpretAppDoctorChecks([agentResult(), staticResult()])

    expect(check?.static.outcome).toBe('clean')
    expect(check?.agent.outcome).toBe('clean')
    expect(check?.static).not.toHaveProperty('promptHash')
  })
})
