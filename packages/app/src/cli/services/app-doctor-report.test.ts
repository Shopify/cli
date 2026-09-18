import {renderAppDoctorStatusReport} from './app-doctor-report.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderTable, renderWarning} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorStatusResult} from './app-doctor-status-json.js'

vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderInfo: vi.fn(),
  renderTable: vi.fn(),
  renderWarning: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

const APP_SCOPE = `scope:${'a'.repeat(64)}`
const WEB_SCOPE = `scope:${'b'.repeat(64)}`
const EXTENSIONS_SCOPE = `scope:${'c'.repeat(64)}`
const FINGERPRINT_A = 'a'.repeat(64)
const FINGERPRINT_B = 'b'.repeat(64)
const FINGERPRINT_C = 'c'.repeat(64)
const FINGERPRINT_D = 'd'.repeat(64)
const FIX = {automated: false, description: 'Redact the value before logging.'}

const emptyResult: AppDoctorStatusResult = {
  schema_version: 1,
  basis: 'stored-results',
  configuration: {identity: 'identity', path: '/repo/app/shopify.app.toml', name: 'shopify.app.staging.toml'},
  app_root: '/repo/app',
  store: {directory: '/repo/.shopify/app-doctor/store/identity', state: 'missing'},
  // Only scopes with recorded results are listed, so an empty store lists none.
  scopes: [],
  findings: [],
  coverage: {
    static_result_count: 0,
    complete: false,
    files_skipped: 0,
    unsupported_languages: [],
    gaps: [],
    owners: [],
  },
  score: {status: 'withheld', reason: 'no_static_results'},
  suppressions: {matched: 0, suppressed_findings: 0, unmatched: []},
  diagnostics: [],
}

const populatedResult: AppDoctorStatusResult = {
  ...emptyResult,
  store: {directory: emptyResult.store.directory, state: 'present'},
  scopes: [
    {
      scope_identity: APP_SCOPE,
      directory: '/repo/app',
      directory_resolved: true,
      checks: [
        {
          check_id: 'CREDENTIAL_LOG_LEAKAGE',
          static: {
            outcome: 'findings',
            produced_at: '2026-09-16T12:00:00.000Z',
            check_version: 1,
            finding_count: 2,
          },
          agent: {
            outcome: 'clean',
            produced_at: '2026-09-17T08:30:00.000Z',
            check_version: 1,
            finding_count: 0,
          },
        },
        {
          check_id: 'WEBHOOK_HMAC_UNVERIFIED',
          static: {outcome: 'not_run'},
          agent: {
            outcome: 'not_applicable',
            produced_at: '2026-09-17T08:30:00.000Z',
            check_version: 2,
            finding_count: 0,
            reason: {code: 'no_relevant_files', message: 'No webhook handlers.'},
          },
        },
        {
          check_id: 'SESSION_TOKEN_UNVERIFIED',
          static: {
            outcome: 'unresolved',
            produced_at: '2026-09-15T09:00:00.000Z',
            check_version: 1,
            finding_count: 0,
            reason: {code: 'agent_investigation_required', message: 'Needs a human.'},
          },
          agent: {
            outcome: 'clean',
            produced_at: '2026-09-18T08:30:00.000Z',
            check_version: 1,
            finding_count: 0,
          },
        },
      ],
    },
    {
      scope_identity: WEB_SCOPE,
      // A scope on another Windows volume has no local spelling, so its recorded reference stands in for the path.
      directory: `volume/${'e'.repeat(64)}/web`,
      directory_resolved: false,
      checks: [
        {
          check_id: 'CREDENTIAL_LOG_LEAKAGE',
          static: {outcome: 'not_run'},
          agent: {
            outcome: 'findings',
            produced_at: '2026-09-10T10:00:00.000Z',
            check_version: 1,
            finding_count: 1,
          },
        },
      ],
    },
    {
      scope_identity: EXTENSIONS_SCOPE,
      directory: '/repo/app/extensions',
      directory_resolved: true,
      checks: [
        {
          check_id: 'CREDENTIAL_LOG_LEAKAGE',
          static: {outcome: 'not_run'},
          agent: {
            outcome: 'clean',
            produced_at: '2026-09-12T10:00:00.000Z',
            check_version: 1,
            finding_count: 0,
          },
        },
      ],
    },
  ],
  findings: [
    {
      fingerprint: FINGERPRINT_A,
      scope_identity: APP_SCOPE,
      code: 'CREDENTIAL_LOG_LEAKAGE',
      severity: 'high',
      title: 'Token logged',
      message: 'The access token is written to the log.',
      location: {file: 'anchor/0/app/routes/auth.ts', path: '/repo/app/routes/auth.ts', line: 12, column: 4},
      sources: ['static'],
      suppressed: false,
      fix: FIX,
      scoring: {eligible: true, points: 25},
    },
    {
      fingerprint: FINGERPRINT_B,
      scope_identity: APP_SCOPE,
      code: 'CREDENTIAL_LOG_LEAKAGE',
      severity: 'medium',
      title: 'Session id logged',
      message: 'The session id is written to the log.',
      location: {file: 'anchor/0/app/routes/session.ts', path: '/repo/app/routes/session.ts'},
      sources: ['static'],
      suppressed: true,
      suppression: {id: 'sup-1', justification: 'Debug build only.'},
      fix: FIX,
      scoring: {eligible: true, points: 10},
    },
    {
      fingerprint: FINGERPRINT_C,
      scope_identity: WEB_SCOPE,
      code: 'CREDENTIAL_LOG_LEAKAGE',
      severity: 'low',
      title: 'Verbose logging',
      message: 'Request headers are logged.',
      // A file on another Windows volume has no local spelling, so `path` is absent and the reference is shown.
      location: {file: `volume/${'e'.repeat(64)}/web/server.ts`, line: 40},
      sources: ['agent'],
      suppressed: false,
      fix: {automated: true, description: 'Drop the header logger.', guide: 'https://example.com/guide'},
      scoring: {eligible: false, points: 0},
    },
  ],
  coverage: {
    static_result_count: 1,
    complete: false,
    files_skipped: 1,
    unsupported_languages: ['ruby'],
    gaps: [{code: 'skipped_file', message: 'File too large.', file: 'app/generated/bundle.js'}],
    owners: [{scope_identity: APP_SCOPE, check_id: 'CREDENTIAL_LOG_LEAKAGE', files_scanned: 12, gap_count: 1}],
  },
  score: {status: 'withheld', reason: 'incomplete_static_coverage'},
  suppressions: {matched: 1, suppressed_findings: 1, unmatched: []},
  diagnostics: [],
}

function reset() {
  vi.mocked(renderInfo).mockClear()
  vi.mocked(renderTable).mockClear()
  vi.mocked(renderWarning).mockClear()
  vi.mocked(outputResult).mockClear()
}

/** Everything the presenter handed to cli-kit, flattened into one searchable string. */
function renderedText(): string {
  return JSON.stringify([
    ...vi.mocked(renderWarning).mock.calls,
    ...vi.mocked(renderInfo).mock.calls,
    ...vi.mocked(renderTable).mock.calls,
  ])
}

describe('renderAppDoctorStatusReport', () => {
  test('an empty store renders one info banner explaining nothing is stored, with next steps only', () => {
    reset()

    renderAppDoctorStatusReport(emptyResult)

    expect(renderWarning).not.toHaveBeenCalled()
    expect(renderTable).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledTimes(1)
    const options = vi.mocked(renderInfo).mock.calls[0]![0]
    expect(options.headline).toBe('No App Doctor results are stored for shopify.app.staging.toml')
    expect(JSON.stringify(options.body)).toContain(emptyResult.store.directory)
    expect(JSON.stringify(options.body)).toContain('No scan was performed')
    const nextSteps = JSON.stringify(options.nextSteps)
    expect(nextSteps).toContain(
      "shopify app doctor instructions --path '/repo/app' --config 'shopify.app.staging.toml'",
    )
    expect(nextSteps).toContain("shopify app doctor --path '/repo/app'")
    expect(nextSteps).not.toContain('shopify app doctor record')
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('a populated store renders scopes, an unsuppressed findings table, a summary, and next steps', () => {
    reset()

    renderAppDoctorStatusReport(populatedResult)

    expect(renderWarning).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledTimes(2)
    const [overview, summary] = vi.mocked(renderInfo).mock.calls.map((call) => call[0])
    expect(overview!.headline).toBe('App Doctor status for shopify.app.staging.toml')
    const overviewBody = JSON.stringify(overview!.body)
    expect(overviewBody).not.toContain(populatedResult.store.directory)
    expect(overviewBody).toContain('No scan was performed')
    // Scopes are named relative to the app root; an unresolvable one shows its recorded reference.
    const scopeTitles = (overview!.body as {list?: {title?: string}}[]).flatMap((token) =>
      typeof token === 'object' && token.list?.title !== undefined ? [token.list.title] : [],
    )
    expect(scopeTitles).toEqual(['.', `volume/${'e'.repeat(64)}/web`, 'extensions'])
    expect(overviewBody).not.toContain('/repo/app/extensions')
    expect(overviewBody).not.toContain('no longer a current review scope')
    expect(overviewBody).not.toContain('No results recorded for this scope.')
    // Each mode gets one grouped line per scope; only checks that need attention are enumerated beneath it.
    const appScopeItems = (overview!.body as {list?: {items: string[]}}[]).find(
      (token) => typeof token === 'object' && token.list?.items.some((item) => item.startsWith('static:')),
    )!.list!.items
    expect(appScopeItems).toEqual([
      [
        'static: 1 findings · 1 unresolved · 1 not run · latest recorded 2026-09-16',
        '  CREDENTIAL_LOG_LEAKAGE: 2 findings (2026-09-16)',
        '  SESSION_TOKEN_UNVERIFIED: unresolved, agent investigation required (2026-09-15)',
      ].join('\n'),
      'agent: 2 clean · 1 not applicable · latest recorded 2026-09-18',
    ])
    expect(overviewBody).toContain('"static: not run"')
    // A single recorded day is just "recorded"; "latest" only appears when a mode spans several days.
    expect(overviewBody).toContain('agent: 1 findings · recorded 2026-09-10')
    expect(overviewBody).toContain('agent: 1 clean · recorded 2026-09-12')
    expect(overviewBody).not.toContain('WEBHOOK_HMAC_UNVERIFIED')
    expect(overviewBody).not.toContain('T12:00:00')

    expect(renderTable).toHaveBeenCalledTimes(1)
    const table = vi.mocked(renderTable).mock.calls[0]![0]
    expect(Object.keys(table.columns)).toEqual(['severity', 'code', 'scope', 'location', 'source'])
    expect(table.rows).toEqual([
      {
        severity: 'high',
        code: 'CREDENTIAL_LOG_LEAKAGE',
        scope: '.',
        location: '/repo/app/routes/auth.ts:12:4',
        source: 'static',
      },
      {
        severity: 'low',
        code: 'CREDENTIAL_LOG_LEAKAGE',
        scope: `volume/${'e'.repeat(64)}/web`,
        location: `volume/${'e'.repeat(64)}/web/server.ts:40`,
        source: 'agent',
      },
    ])

    const summaryBody = JSON.stringify(summary!.body)
    expect(summaryBody).toContain('Findings shown: 2')
    expect(summaryBody).toContain('Suppressed: 1')
    expect(summaryBody).toContain('Static coverage: incomplete (1 gap)')
    expect(summaryBody).toContain('Score: withheld (incomplete static coverage)')
    // Nothing is left to suggest: instructions exist, static results exist, and record is not a next step.
    expect(summary!.nextSteps ?? []).toEqual([])
    expect(JSON.stringify(summary)).not.toContain('shopify app doctor record')
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('a graded score and complete coverage are spelled out; static-only gaps invite a static scan', () => {
    reset()
    const graded: AppDoctorStatusResult = {
      ...populatedResult,
      coverage: {...populatedResult.coverage, complete: true, gaps: []},
      score: {status: 'graded', total: 87, grade: 'GOOD'},
    }

    renderAppDoctorStatusReport(graded)

    const summaryBody = JSON.stringify(vi.mocked(renderInfo).mock.calls[1]![0].body)
    expect(summaryBody).toContain('Static coverage: complete')
    expect(summaryBody).toContain('Score: 87 (GOOD)')
  })

  test('agent-only results report no static results and point at the static scan', () => {
    reset()
    const agentOnly: AppDoctorStatusResult = {
      ...populatedResult,
      coverage: {...emptyResult.coverage},
      score: {status: 'withheld', reason: 'no_static_results'},
    }

    renderAppDoctorStatusReport(agentOnly)

    const summary = vi.mocked(renderInfo).mock.calls[1]![0]
    expect(JSON.stringify(summary.body)).toContain('Static coverage: no static results')
    expect(JSON.stringify(summary.body)).toContain('Score: withheld (no static results)')
    expect(JSON.stringify(summary.nextSteps)).toContain("shopify app doctor --path '/repo/app'")
  })

  test('a current scope below the app root is shown relative to it in the findings table', () => {
    reset()
    const nested: AppDoctorStatusResult = {
      ...populatedResult,
      findings: [{...populatedResult.findings[0]!, scope_identity: EXTENSIONS_SCOPE}],
    }

    renderAppDoctorStatusReport(nested)

    expect(vi.mocked(renderTable).mock.calls[0]![0].rows).toEqual([expect.objectContaining({scope: 'extensions'})])
  })

  test('suppressions that match no stored finding are listed in a warning', () => {
    reset()
    const withUnmatched: AppDoctorStatusResult = {
      ...populatedResult,
      suppressions: {
        ...populatedResult.suppressions,
        unmatched: [
          {id: 'sup-old', finding_fingerprint: `sha256:${'1'.repeat(64)}`},
          {id: 'sup-typo', finding_fingerprint: `sha256:${'2'.repeat(64)}`},
        ],
      },
    }

    renderAppDoctorStatusReport(withUnmatched)

    expect(renderWarning).toHaveBeenCalledTimes(1)
    const warning = JSON.stringify(vi.mocked(renderWarning).mock.calls[0]![0])
    expect(warning).toContain('2 suppressions match no stored finding and have no effect: sup-old, sup-typo')
  })

  test('store diagnostics are rendered as a warning before the status', () => {
    reset()
    const withDiagnostics: AppDoctorStatusResult = {
      ...populatedResult,
      diagnostics: [
        {source: 'store', code: 'misowned', message: 'Owned by another configuration.', path: '/store/x.json'},
        {source: 'store', code: 'malformed', message: 'Not JSON.', path: '/store/suppressions.json'},
      ],
    }

    renderAppDoctorStatusReport(withDiagnostics)

    expect(renderWarning).toHaveBeenCalledTimes(1)
    const warning = JSON.stringify(vi.mocked(renderWarning).mock.calls[0]![0])
    expect(warning).toContain('misowned: Owned by another configuration. (/store/x.json)')
    expect(warning).toContain('malformed: Not JSON. (/store/suppressions.json)')
    expect(vi.mocked(renderWarning).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(renderInfo).mock.invocationCallOrder[0]!,
    )
  })

  test('text and JSON are semantically identical: every outcome, unsuppressed finding, and the score appear', () => {
    reset()

    const result: AppDoctorStatusResult = {
      ...populatedResult,
      findings: [
        ...populatedResult.findings,
        {
          fingerprint: FINGERPRINT_D,
          scope_identity: APP_SCOPE,
          code: 'SESSION_TOKEN_UNVERIFIED',
          severity: 'medium',
          title: 'Token accepted unverified',
          message: 'The session token is decoded without checking its signature.',
          location: {file: 'anchor/0/app/routes/app.ts', path: '/repo/app/routes/app.ts', line: 7},
          sources: ['static', 'agent'],
          suppressed: false,
          fix: FIX,
          scoring: {eligible: true, points: 15},
        },
      ],
    }

    renderAppDoctorStatusReport(result)

    const text = renderedText()
    const words = (identifier: string) => identifier.replace(/_/g, ' ')
    const day = (producedAt: string) => producedAt.slice(0, 'YYYY-MM-DD'.length)
    const scopeLabel = (scope: AppDoctorStatusResult['scopes'][number]): string => {
      if (!scope.directory_resolved) return scope.directory
      return scope.directory === result.app_root ? '.' : scope.directory.slice(`${result.app_root}/`.length)
    }
    for (const scope of result.scopes) {
      expect(text).toContain(scopeLabel(scope))
      for (const mode of ['static', 'agent'] as const) {
        const outcomes = scope.checks.map((check) => check[mode])
        if (outcomes.length > 0 && outcomes.every((entry) => entry.outcome === 'not_run')) {
          expect(text).toContain(`${mode}: not run`)
          continue
        }
        for (const outcome of new Set(outcomes.map((entry) => entry.outcome))) {
          const count = outcomes.filter((entry) => entry.outcome === outcome).length
          expect(text).toContain(`${count} ${words(outcome)}`)
        }
        // Checks needing attention are named with their recorded day; the rest are only counted.
        const attention = new Set(
          scope.checks
            .filter((check) => check[mode].outcome === 'findings' || check[mode].outcome === 'unresolved')
            .map((check) => check.check_id),
        )
        for (const check of scope.checks) {
          const entry = check[mode]
          if (!attention.has(check.check_id) || entry.outcome === 'not_run') continue
          expect(text).toContain(`${check.check_id}: `)
          expect(text).toContain(`(${day(entry.produced_at)})`)
        }
      }
    }

    // The table is compared as a set: one row per unsuppressed finding, in any order.
    const rows = vi.mocked(renderTable).mock.calls[0]![0].rows
    const shown = result.findings.filter((finding) => !finding.suppressed)
    const scopesByIdentity = new Map(result.scopes.map((scope) => [scope.scope_identity, scope]))
    const expectedRows = new Map(
      shown.map((finding) => [
        finding.fingerprint,
        {
          severity: finding.severity,
          code: finding.code,
          scope: scopeLabel(scopesByIdentity.get(finding.scope_identity)!),
          location: [finding.location.path ?? finding.location.file, finding.location.line, finding.location.column]
            .filter((part) => part !== undefined)
            .join(':'),
          source: finding.sources.join('+'),
        },
      ]),
    )
    expect(new Set(rows)).toEqual(new Set(expectedRows.values()))
    expect(expectedRows.size).toBe(shown.length)
    expect(rows.map((row) => row.source)).toContain('static+agent')

    expect(text).toContain(`Suppressed: ${result.suppressions.suppressed_findings}`)
    expect(text).toContain(result.score.status)
    if (result.score.status === 'withheld') {
      expect(text).toContain(words(result.score.reason))
    }
  })
})
