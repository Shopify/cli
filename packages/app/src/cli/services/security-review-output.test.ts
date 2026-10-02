import {
  buildSecurityReviewAlerts,
  buildSecurityReviewSummary,
  renderSecurityReview,
  type SecurityReviewPresenterInput,
} from './security-review-output.js'
import {reviewAppSecurityResults} from './security-review.js'
import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {appSecurityResultsFor, type AppSecurityResultsSources} from './app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {unstyled} from '@shopify/cli-kit/node/output'
import {cwd} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {AppSecurityBlockingLevel} from './app-security-api.js'
import type {AgentFindingsDocument, DeterministicFindingsDocument} from './app-security-engine/index.js'

const appRoot = '/tmp/review-app'
const paths = appSecurityArtifactPaths(appRoot, 'shopify.app')
const commands = resolveAppSecurityCommands(
  {kind: 'config', appDirectory: appRoot, appConfigFilePath: `${appRoot}/shopify.app.toml`},
  cwd(),
)
const checkCommand = formatAppSecurityCommand(commands.scan)
// One hour after the agent file, two and a half after the deterministic one.
const now = new Date('2026-09-01T12:30:00.000Z')

type Sources = AppSecurityResultsSources

function presenterInput(
  sources: Sources,
  options: {checkIds?: string[]; blocking?: AppSecurityBlockingLevel; verbose?: boolean} = {},
): SecurityReviewPresenterInput {
  const result = reviewAppSecurityResults(appSecurityResultsFor(appRoot, 'shopify.app', sources), {
    resultsDirectory: paths.resultsDirectory,
    checkIds: options.checkIds ?? [],
    blocking: options.blocking ?? 'none',
  })
  return {result, verbose: options.verbose ?? false, now, commands}
}

const both: Sources = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}
const deterministicOnly: Sources = {deterministic: deterministicFindingsDocument, agent: null}
const agentOnly: Sources = {deterministic: null, agent: agentFindingsDocument}
const none: Sources = {deterministic: null, agent: null}

/**
 * The agent file recorded before the deterministic one (three and a half hours before `now`), so its
 * `prefer-agent` result for CREDENTIAL_LOG_LEAKAGE is stale and the check shows both sources.
 */
const staleAgent: Sources = {
  deterministic: deterministicFindingsDocument,
  agent: {...agentFindingsDocument, generated_at: '2026-09-01T09:00:00.000Z'},
}

/** The fixture documents with every finding removed, so every check passes or is unresolved/not applicable. */
const bothWithoutFindings: Sources = {
  deterministic: {
    ...deterministicFindingsDocument,
    checks: deterministicFindingsDocument.checks.map((check) => ({...check, findings: []})),
  },
  agent: {
    ...agentFindingsDocument,
    checks: agentFindingsDocument.checks.map((check) => ({...check, findings: []})),
  },
}

describe('buildSecurityReviewSummary', () => {
  describe('box type and headline', () => {
    test('is an error with a headline counting findings and unresolved checks when a high finding is active', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both))

      expect(summary.type).toBe('error')
      // CREDENTIAL_LOG_LEAKAGE, EOL_API_VERSION and MISSING_TENANT_ISOLATION have active findings;
      // UNAUTHENTICATED_ENDPOINT is unresolved by the agent alone.
      expect(summary.headline).toBe('3 checks with findings. 1 check unresolved.')
    })

    test('is a warning when only a low finding is active', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both, {checkIds: ['EOL_API_VERSION']}))

      expect(summary.type).toBe('warning')
      expect(summary.headline).toBe('1 check with findings.')
    })

    test('is a warning with a no-findings headline when a check is unresolved', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both, {checkIds: ['UNAUTHENTICATED_ENDPOINT']}))

      expect(summary.type).toBe('warning')
      expect(summary.headline).toBe('No findings in 1 check.')
    })

    test('is a success when every check passed or is not applicable', () => {
      const summary = buildSecurityReviewSummary(
        presenterInput(both, {checkIds: ['OPEN_REDIRECT', 'UNSAFE_INNERHTML']}),
      )

      expect(summary.type).toBe('success')
      expect(summary.headline).toBe('No findings in 2 checks.')
    })

    test('is an info box when neither file is present', () => {
      const summary = buildSecurityReviewSummary(presenterInput(none))

      expect(summary.type).toBe('info')
      expect(summary.headline).toBe('No App Security results to review.')
    })
  })

  describe('filter line', () => {
    test('shows the filtered count out of every combined check', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both, {checkIds: ['EOL_API_VERSION', 'OPEN_REDIRECT']}))

      expect(summary.filterLine).toBe('Showing 2 of 6 checks (--check-id).')
    })

    test('is omitted without --check-id and when no file is present', () => {
      expect(buildSecurityReviewSummary(presenterInput(both)).filterLine).toBeUndefined()
      expect(buildSecurityReviewSummary(presenterInput(none, {checkIds: ['ANYTHING']})).filterLine).toBeUndefined()
    })
  })

  describe('checks with findings', () => {
    test('lists severity, ID and active counts by source, leaving out zero sources', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both))

      expect(summary.checksWithFindings).toEqual([
        // prefer-agent: the two deterministic findings are superseded, so only the agent finding is active.
        {severity: 'High', id: 'CREDENTIAL_LOG_LEAKAGE', counts: '1 agent'},
        // union: one active agent finding, one suppressed.
        {severity: 'High', id: 'MISSING_TENANT_ISOLATION', counts: '1 agent'},
        {severity: 'Low', id: 'EOL_API_VERSION', counts: '1 deterministic'},
      ])
    })

    test('counts both sources when both have active findings', () => {
      const unionSources: Sources = {
        ...both,
        agent: {
          ...agentFindingsDocument,
          checks: agentFindingsDocument.checks.map((check) =>
            check.id === 'CREDENTIAL_LOG_LEAKAGE'
              ? {...check, snapshot: {...check.snapshot, precedence: 'union' as const}}
              : check,
          ),
        },
      }

      const summary = buildSecurityReviewSummary(presenterInput(unionSources, {checkIds: ['CREDENTIAL_LOG_LEAKAGE']}))

      expect(summary.checksWithFindings).toEqual([
        {severity: 'High', id: 'CREDENTIAL_LOG_LEAKAGE', counts: '2 deterministic, 1 agent'},
      ])
    })
  })

  describe('other checks', () => {
    test('lists the non-zero status counts and the non-zero disposition counts, pluralized', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both))

      expect(summary.otherChecks).toEqual([
        '1 passed · 1 not applicable · 1 unresolved',
        '1 finding suppressed · 2 findings superseded',
      ])
    })

    test('adds a line counting the stale checks, pluralized, only when a filtered check is stale', () => {
      expect(buildSecurityReviewSummary(presenterInput(staleAgent)).staleAgentResults).toBe(
        '1 check shows both sources because the agent results are older than the deterministic results.',
      )
      expect(buildSecurityReviewSummary(presenterInput(both)).staleAgentResults).toBeUndefined()
      expect(
        buildSecurityReviewSummary(presenterInput(staleAgent, {checkIds: ['OPEN_REDIRECT']})).staleAgentResults,
      ).toBeUndefined()
    })

    test('pluralizes the stale line for several checks', () => {
      const agent: AgentFindingsDocument = {
        ...staleAgent.agent!,
        checks: staleAgent.agent!.checks.map((check) => ({
          ...check,
          snapshot: {...check.snapshot, precedence: 'prefer-agent'},
        })),
      }

      const summary = buildSecurityReviewSummary(presenterInput({deterministic: deterministicFindingsDocument, agent}))

      // CREDENTIAL_LOG_LEAKAGE, MISSING_TENANT_ISOLATION and OPEN_REDIRECT are in both files.
      expect(summary.staleAgentResults).toBe(
        '3 checks show both sources because the agent results are older than the deterministic results.',
      )
    })

    test('leaves out an empty line and the whole section', () => {
      expect(buildSecurityReviewSummary(presenterInput(both, {checkIds: ['EOL_API_VERSION']})).otherChecks).toEqual([])
      expect(buildSecurityReviewSummary(presenterInput(both, {checkIds: ['OPEN_REDIRECT']})).otherChecks).toEqual([
        '1 passed',
      ])
      expect(
        buildSecurityReviewSummary(presenterInput(both, {checkIds: ['CREDENTIAL_LOG_LEAKAGE']})).otherChecks,
      ).toEqual(['2 findings superseded'])
    })
  })

  describe('deterministic coverage', () => {
    test('counts skipped files by reason and unsupported languages with file counts', () => {
      const deterministic: DeterministicFindingsDocument = {
        ...deterministicFindingsDocument,
        detection: {
          ...deterministicFindingsDocument.detection,
          languages: [
            ...deterministicFindingsDocument.detection.languages,
            {name: 'php', support: 'unsupported', files: ['a.php', 'b.php']},
            {name: 'ruby', support: 'unsupported', files: ['c.rb']},
          ],
        },
        coverage: {
          ...deterministicFindingsDocument.coverage,
          files_skipped: [
            {path: 'a.js', reason: 'too_large'},
            {path: 'b.js', reason: 'too_large'},
            {path: 'c.js', reason: 'unreadable'},
          ],
        },
      }

      const summary = buildSecurityReviewSummary(presenterInput({deterministic, agent: null}))

      expect(summary.coverage).toBe(
        'Deterministic coverage: 12 files scanned, 3 skipped (2 too large, 1 unreadable). Unsupported languages: php (2 files), ruby (1 file).',
      )
    })

    test('says none skipped and omits languages when everything is supported', () => {
      const deterministic: DeterministicFindingsDocument = {
        ...deterministicFindingsDocument,
        coverage: {...deterministicFindingsDocument.coverage, files_skipped: []},
      }

      const summary = buildSecurityReviewSummary(presenterInput({deterministic, agent: null}))

      expect(summary.coverage).toBe('Deterministic coverage: 12 files scanned, none skipped.')
    })

    test('pluralizes the scanned file count', () => {
      const deterministic: DeterministicFindingsDocument = {
        ...deterministicFindingsDocument,
        coverage: {...deterministicFindingsDocument.coverage, files_scanned: 1, files_skipped: []},
      }

      const summary = buildSecurityReviewSummary(presenterInput({deterministic, agent: null}))

      expect(summary.coverage).toBe('Deterministic coverage: 1 file scanned, none skipped.')
    })

    test('is omitted when the deterministic file is missing', () => {
      expect(buildSecurityReviewSummary(presenterInput(agentOnly)).coverage).toBeUndefined()
    })
  })

  describe('scope', () => {
    const differentScope = {include_dirs: ['../backend'], excludes: ['**/generated'], no_git_ignore: true}
    const scopedScan: DeterministicFindingsDocument = {
      ...deterministicFindingsDocument,
      coverage: {
        ...deterministicFindingsDocument.coverage,
        scope: differentScope,
        scan_directories: [
          {directory: '.', origin: 'app_directory'},
          {directory: '../backend', origin: 'include_dir'},
        ],
      },
    }
    const note = 'Agent findings were recorded for a different scope than the latest scan.'

    test('shows the scan directories, the scan scope and the scope the agent reported', () => {
      const summary = buildSecurityReviewSummary(
        presenterInput({deterministic: scopedScan, agent: {...agentFindingsDocument, scope: differentScope}}),
      )

      expect(summary.scopeLines).toEqual([
        'Scan directories: ., ../backend',
        'Scan scope: --include-dir ../backend --exclude **/generated --no-git-ignore',
        'Scope reported by the agent: --include-dir ../backend --exclude **/generated --no-git-ignore',
      ])
    })

    test('says none for a scope without flags and shows only the sources that exist', () => {
      expect(buildSecurityReviewSummary(presenterInput(deterministicOnly)).scopeLines).toEqual([
        'Scan directories: .',
        'Scan scope: none',
      ])
      expect(buildSecurityReviewSummary(presenterInput(agentOnly)).scopeLines).toEqual([
        'Scope reported by the agent: none',
      ])
      expect(buildSecurityReviewSummary(presenterInput(none)).scopeLines).toEqual([])
    })

    test('notes when the agent findings were recorded for a different scope than the latest scan', () => {
      const summary = buildSecurityReviewSummary(
        presenterInput({deterministic: scopedScan, agent: agentFindingsDocument}),
      )

      expect(summary.scopeNote).toBe(note)
    })

    test('has no note when the scopes match, or when only one source exists', () => {
      const matching = {deterministic: scopedScan, agent: {...agentFindingsDocument, scope: differentScope}}

      expect(buildSecurityReviewSummary(presenterInput(matching)).scopeNote).toBeUndefined()
      expect(buildSecurityReviewSummary(presenterInput(both)).scopeNote).toBeUndefined()
      expect(buildSecurityReviewSummary(presenterInput(deterministicOnly)).scopeNote).toBeUndefined()
      expect(buildSecurityReviewSummary(presenterInput(agentOnly)).scopeNote).toBeUndefined()
    })

    test('treats the same values in a different order as a different scope', () => {
      const reordered = {...differentScope, excludes: ['b', 'a']}
      const sources = {
        deterministic: {
          ...scopedScan,
          coverage: {...scopedScan.coverage, scope: {...differentScope, excludes: ['a', 'b']}},
        },
        agent: {...agentFindingsDocument, scope: reordered},
      }

      expect(buildSecurityReviewSummary(presenterInput(sources)).scopeNote).toBe(note)
    })

    test('renders the scopes, and the note only when they differ', () => {
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityReview(presenterInput({deterministic: scopedScan, agent: agentFindingsDocument}))

      const different = unstyled(output.error())
      expect(different).toContain('Scan directories: ., ../backend')
      expect(different).toContain('Scope reported by the agent: none')
      expect(different).toContain(note)
      output.clear()

      renderSecurityReview(presenterInput(both))

      expect(unstyled(output.error())).not.toContain(note)
      output.clear()
    })
  })

  describe('results files', () => {
    test('names the results directory once and shows age and engine version per file', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both))

      expect(summary.resultsFiles).toEqual({
        directory: paths.resultsDirectory,
        rows: [
          {name: 'deterministic-findings.json', updated: '2 hours ago', engine: '3.99.0'},
          {name: 'agent-findings.json', updated: '1 hour ago', engine: '3.99.0'},
        ],
      })
    })

    test('shows a missing file as not found', () => {
      const summary = buildSecurityReviewSummary(presenterInput(deterministicOnly))

      expect(summary.resultsFiles.rows[1]).toEqual({name: 'agent-findings.json', updated: 'not found'})
    })

    test('shows both files as not found when neither is present', () => {
      const summary = buildSecurityReviewSummary(presenterInput(none))

      expect(summary.resultsFiles.rows).toEqual([
        {name: 'deterministic-findings.json', updated: 'not found'},
        {name: 'agent-findings.json', updated: 'not found'},
      ])
    })
  })

  describe('next steps', () => {
    test('offers fixing when there are active findings', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both))

      expect(summary.blocking).toBeUndefined()
      expect(summary.nextSteps).toEqual([
        [
          'Fix the issues, then run',
          {command: checkCommand},
          'again. Your coding agent can run it too, which also updates',
          {filePath: 'agent-findings.json'},
          {char: '.'},
        ],
      ])
    })

    test('offers a deeper review when only the deterministic file is present and nothing is found', () => {
      const summary = buildSecurityReviewSummary(
        presenterInput(deterministicOnly, {checkIds: ['OPEN_REDIRECT', 'UNSAFE_INNERHTML']}),
      )

      expect(summary.nextSteps).toEqual([
        ['For a deeper review, have your coding agent run', {command: checkCommand}, {char: '.'}],
      ])
    })

    test('offers refreshing the agent results after fixing when a filtered check is stale', () => {
      const summary = buildSecurityReviewSummary(presenterInput(staleAgent))

      expect(summary.nextSteps).toEqual([
        [
          'Fix the issues, then run',
          {command: checkCommand},
          'again. Your coding agent can run it too, which also updates',
          {filePath: 'agent-findings.json'},
          {char: '.'},
        ],
        [
          'Agent results are older than the deterministic results. Have your coding agent run',
          {command: checkCommand},
          'to refresh them.',
        ],
      ])
    })

    test('omits the refresh step when no filtered check is stale', () => {
      const summary = buildSecurityReviewSummary(presenterInput(staleAgent, {checkIds: ['EOL_API_VERSION']}))

      expect(summary.nextSteps).toEqual([expect.arrayContaining(['Fix the issues, then run'])])
    })

    test('offers fixing without a deeper review when the deterministic file alone has findings', () => {
      const summary = buildSecurityReviewSummary(presenterInput(deterministicOnly))

      expect(summary.nextSteps?.map((step) => (Array.isArray(step) ? step[0] : step))).toEqual([
        'Fix the issues, then run',
      ])
    })

    test('offers no next steps when both files are present and nothing is found', () => {
      const summary = buildSecurityReviewSummary(presenterInput(bothWithoutFindings))

      expect(summary.nextSteps).toEqual([])
    })

    test('offers a single create step when both files are missing', () => {
      const summary = buildSecurityReviewSummary(presenterInput(none))

      expect(summary.nextSteps).toEqual([['Run', {command: checkCommand}, 'or have your coding agent run it.']])
    })

    test('replaces the next steps with a Blocking line when --blocking is breached', () => {
      const summary = buildSecurityReviewSummary(presenterInput(both, {blocking: 'high'}))

      expect(summary.nextSteps).toBeUndefined()
      expect(summary.blocking).toBe('2 checks at or above high (--blocking high).')
    })

    test('replaces the refresh step with the Blocking line too, keeping the stale summary line', () => {
      const summary = buildSecurityReviewSummary(presenterInput(staleAgent, {blocking: 'high'}))

      expect(summary.nextSteps).toBeUndefined()
      expect(summary.blocking).toBe('2 checks at or above high (--blocking high).')
      expect(summary.staleAgentResults).toBe(
        '1 check shows both sources because the agent results are older than the deterministic results.',
      )
    })

    test('keeps the next steps when --blocking is not breached', () => {
      const summary = buildSecurityReviewSummary(
        presenterInput(both, {checkIds: ['EOL_API_VERSION'], blocking: 'high'}),
      )

      expect(summary.blocking).toBeUndefined()
      expect(summary.nextSteps).toHaveLength(1)
    })
  })
})

describe('buildSecurityReviewAlerts', () => {
  test('orders the boxes: unresolved, passed, one per check with findings, then the summary', () => {
    const alerts = buildSecurityReviewAlerts(presenterInput(both))

    expect(alerts.map((alert) => [alert.type, alert.options.headline])).toEqual([
      ['warning', '1 check unresolved.'],
      ['info', '1 check passed. 1 check not applicable.'],
      ['error', 'High · CREDENTIAL_LOG_LEAKAGE · Credential reaches a log sink'],
      ['error', 'High · MISSING_TENANT_ISOLATION · Database query may not be scoped by shop'],
      ['warning', 'Low · EOL_API_VERSION · End-of-life API version'],
      ['error', '3 checks with findings. 1 check unresolved.'],
    ])
  })

  test('renders only the summary when no file is present', () => {
    const alerts = buildSecurityReviewAlerts(presenterInput(none))

    expect(alerts.map((alert) => alert.type)).toEqual(['info'])
  })

  test('shows every active finding with its source, location, message and source-specific details', () => {
    const [alert] = buildSecurityReviewAlerts(presenterInput(both, {checkIds: ['MISSING_TENANT_ISOLATION']}))

    expect(alert!.options.body).toEqual({subdued: '1 finding suppressed'})
    // The deterministic result was unresolved and the agent's executed, so both statuses are shown.
    expect(alert!.options.customSections).toEqual([
      {
        body: {
          tabularData: [
            ['deterministic', 'unresolved — The TypeScript parser was unavailable for app/routes/orders.tsx.'],
            ['agent', 'executed'],
          ],
          firstColumnSubdued: true,
        },
      },
      {
        title: 'agent · app/routes/orders.tsx:31',
        body: [
          'Orders are loaded for every shop: the query has no shop filter.',
          {subdued: '\nCode: const orders = await prisma.order.findMany()'},
          {subdued: '\nConfidence: high'},
          {subdued: '\nReasoning: The loader authenticates the shop but never uses session.shop in the query.'},
        ],
      },
    ])
  })

  test('shows both sources with their ages and explains why for a stale check', () => {
    const [alert] = buildSecurityReviewAlerts(presenterInput(staleAgent, {checkIds: ['CREDENTIAL_LOG_LEAKAGE']}))

    expect(alert!.type).toBe('error')
    expect(alert!.options.body).toBeUndefined()
    // Both sources executed, so without the stale state the statuses would be left out.
    expect(alert!.options.customSections!.slice(0, 2)).toEqual([
      {
        body: {
          tabularData: [
            ['deterministic', 'executed', '2 hours ago'],
            ['agent', 'executed', '3 hours ago'],
          ],
          firstColumnSubdued: true,
        },
      },
      {body: {subdued: 'The agent result is older than the deterministic result, so both are shown.'}},
    ])
    // Union applies: the deterministic findings are active alongside the agent's.
    expect(alert!.options.customSections!.slice(2).map((section) => section.title)).toEqual([
      'deterministic \u00b7 app/routes/orders.tsx:12',
      'agent \u00b7 app/routes/orders.tsx:12',
      'deterministic \u00b7 app/shopify.server.ts:40',
    ])
  })

  test('marks stale checks in the passed and unresolved boxes', () => {
    // Without findings, the stale CREDENTIAL_LOG_LEAKAGE passes; an unresolved deterministic result and a stale
    // unresolved agent result leave MISSING_TENANT_ISOLATION unresolved.
    const sources: Sources = {
      deterministic: bothWithoutFindings.deterministic,
      agent: {
        ...bothWithoutFindings.agent!,
        generated_at: staleAgent.agent!.generated_at,
        checks: bothWithoutFindings.agent!.checks.map((check) =>
          check.id === 'MISSING_TENANT_ISOLATION'
            ? {
                ...check,
                status: 'unresolved',
                reason: {code: 'needs_runtime', message: 'Could not trace the query statically.'},
                snapshot: {...check.snapshot, precedence: 'prefer-agent'},
              }
            : check,
        ),
      },
    }

    const [unresolved, passed] = buildSecurityReviewAlerts(
      presenterInput(sources, {checkIds: ['CREDENTIAL_LOG_LEAKAGE', 'MISSING_TENANT_ISOLATION', 'OPEN_REDIRECT']}),
    )

    expect(unresolved!.options.customSections).toEqual([
      {
        title: 'MISSING_TENANT_ISOLATION \u00b7 Database query may not be scoped by shop',
        body: {
          tabularData: [
            ['deterministic', 'unresolved \u2014 The TypeScript parser was unavailable for app/routes/orders.tsx.'],
            ['agent', 'unresolved \u2014 Could not trace the query statically. \u00b7 agent result stale'],
          ],
          firstColumnSubdued: true,
        },
      },
    ])
    expect(passed!.options.customSections![0]!.body).toEqual({
      tabularData: [
        ['CREDENTIAL_LOG_LEAKAGE', 'passed \u00b7 agent result stale'],
        ['OPEN_REDIRECT', 'passed'],
      ],
    })
  })

  test('shows the fix and guide for a deterministic finding', () => {
    const [alert] = buildSecurityReviewAlerts(presenterInput(deterministicOnly, {checkIds: ['EOL_API_VERSION']}))

    expect(alert!.options.customSections).toEqual([
      {
        title: 'deterministic · shopify.app.toml:8',
        body: [
          'api_version 2024-01 is past its support window.',
          {subdued: '\nFix: Update api_version in shopify.app.toml and the ApiVersion enum in shopify.server.ts.'},
          {subdued: '\nGuide: https://shopify.dev/docs/api/usage/versioning'},
        ],
      },
    ])
  })

  test('truncates long reasoning to three lines unless verbose', () => {
    const reasoning = ['first', 'second', 'third', 'fourth'].join('\n')
    const agent: AgentFindingsDocument = {
      ...agentFindingsDocument,
      checks: agentFindingsDocument.checks.map((check) =>
        check.id === 'CREDENTIAL_LOG_LEAKAGE'
          ? {...check, findings: check.findings.map((finding) => ({...finding, reasoning}))}
          : check,
      ),
    }
    const sources: Sources = {deterministic: null, agent}

    const [concise] = buildSecurityReviewAlerts(presenterInput(sources, {checkIds: ['CREDENTIAL_LOG_LEAKAGE']}))
    const [verbose] = buildSecurityReviewAlerts(
      presenterInput(sources, {checkIds: ['CREDENTIAL_LOG_LEAKAGE'], verbose: true}),
    )

    expect(concise!.options.customSections![0]!.body).toContainEqual({subdued: '\nReasoning: first\nsecond\nthird…'})
    expect(verbose!.options.customSections![0]!.body).toContainEqual({
      subdued: `\nReasoning: ${reasoning}`,
    })
  })

  test('adds evidence and the suppressed and superseded findings with --verbose', () => {
    const [alert] = buildSecurityReviewAlerts(
      presenterInput(both, {checkIds: ['MISSING_TENANT_ISOLATION'], verbose: true}),
    )

    const sections = alert!.options.customSections!
    expect(sections.map((section) => section.title)).toEqual([
      undefined,
      'agent · app/routes/admin.settings.tsx:55 (suppressed)',
      'agent · app/routes/orders.tsx:31',
    ])
    expect(sections[1]!.body).toContainEqual({
      subdued: '\nSuppressed: The route is restricted to the app owner by an allowlist middleware.',
    })
    expect(sections[2]!.body).toContainEqual({
      subdued: '\nEvidence: app/routes/orders.tsx:31 — prisma.order.findMany()',
    })
    expect(sections[2]!.body).toContainEqual({
      subdued: '\nEvidence: app/routes/orders.tsx:18 — const {session} = await authenticate.admin(request)',
    })
  })

  test('does not print the suppression of a hand-edited deterministic finding with --verbose', () => {
    // Only the agent suppresses findings: a deterministic `suppression` is ignored, so the finding stays active.
    const deterministic: DeterministicFindingsDocument = {
      ...deterministicFindingsDocument,
      checks: deterministicFindingsDocument.checks.map((check) =>
        check.id === 'EOL_API_VERSION'
          ? {
              ...check,
              findings: check.findings.map((finding) => ({...finding, suppression: {justification: 'Hand-edited.'}})),
            }
          : check,
      ),
    }

    const [alert] = buildSecurityReviewAlerts(
      presenterInput({deterministic, agent: null}, {checkIds: ['EOL_API_VERSION'], verbose: true}),
    )

    expect(alert!.options.customSections).toEqual([
      {
        title: 'deterministic · shopify.app.toml:8',
        body: [
          'api_version 2024-01 is past its support window.',
          {subdued: '\nFix: Update api_version in shopify.app.toml and the ApiVersion enum in shopify.server.ts.'},
          {subdued: '\nGuide: https://shopify.dev/docs/api/usage/versioning'},
          {subdued: '\nEvidence: shopify.app.toml:8 — api_version = "2024-01"'},
        ],
      },
    ])
  })

  test('lists each source status and reason for an unresolved check', () => {
    const [alert] = buildSecurityReviewAlerts(presenterInput(both, {checkIds: ['UNAUTHENTICATED_ENDPOINT']}))

    expect(alert!.type).toBe('warning')
    expect(alert!.options.customSections).toEqual([
      {
        title: 'UNAUTHENTICATED_ENDPOINT · Route handler lacks recognized auth verification',
        body: {
          tabularData: [
            ['agent', 'unresolved — Route registration happens at runtime and could not be traced statically.'],
          ],
          firstColumnSubdued: true,
        },
      },
    ])
  })

  test('lists the suppressed and superseded findings of unresolved checks in full with --verbose', () => {
    // The agent's prefer-agent result supersedes both deterministic findings, and its own finding is suppressed,
    // so the unresolved check has no active findings.
    const agent: AgentFindingsDocument = {
      ...agentFindingsDocument,
      checks: agentFindingsDocument.checks.map((check) =>
        check.id === 'CREDENTIAL_LOG_LEAKAGE'
          ? {
              ...check,
              status: 'unresolved',
              reason: {code: 'dynamic_logger', message: 'The logger is configured at runtime.'},
              findings: check.findings.map((finding) => ({
                ...finding,
                suppression: {justification: 'The token is redacted by the logger.'},
              })),
            }
          : check,
      ),
    }
    const sources: Sources = {deterministic: deterministicFindingsDocument, agent}

    const [concise] = buildSecurityReviewAlerts(presenterInput(sources, {checkIds: ['CREDENTIAL_LOG_LEAKAGE']}))
    const [verbose] = buildSecurityReviewAlerts(
      presenterInput(sources, {checkIds: ['CREDENTIAL_LOG_LEAKAGE'], verbose: true}),
    )

    expect(concise!.options.headline).toBe('1 check unresolved.')
    expect(concise!.options.customSections).toHaveLength(1)
    expect(verbose!.options.headline).toBe('1 check unresolved.')
    const sections = verbose!.options.customSections!
    expect(sections[0]).toEqual(concise!.options.customSections![0])
    expect(sections.slice(1).map((section) => section.title)).toEqual([
      'CREDENTIAL_LOG_LEAKAGE \u00b7 deterministic \u00b7 app/routes/orders.tsx:12 (superseded)',
      'CREDENTIAL_LOG_LEAKAGE \u00b7 agent \u00b7 app/routes/orders.tsx:12 (suppressed)',
      'CREDENTIAL_LOG_LEAKAGE \u00b7 deterministic \u00b7 app/shopify.server.ts:40 (superseded)',
    ])
    expect(sections[1]!.body).toContainEqual({
      subdued: '\nEvidence: app/routes/orders.tsx:12 \u2014 console.log(session.accessToken)',
    })
    expect(sections[2]).toEqual({
      title: 'CREDENTIAL_LOG_LEAKAGE \u00b7 agent \u00b7 app/routes/orders.tsx:12 (suppressed)',
      body: [
        'The session access token is written to the server log.',
        {subdued: '\nConfidence: high'},
        {
          subdued:
            '\nReasoning: The logged object is the authenticated session, whose accessToken is a live credential.',
        },
        {subdued: '\nEvidence: app/routes/orders.tsx:12 \u2014 console.log(session.accessToken)'},
        {subdued: '\nSuppressed: The token is redacted by the logger.'},
      ],
    })
  })

  test('lists passed and not applicable checks with their disposition counts', () => {
    // With no active findings, MISSING_TENANT_ISOLATION passes; its one finding is suppressed.
    const agent: AgentFindingsDocument = {
      ...agentFindingsDocument,
      checks: agentFindingsDocument.checks.map((check) =>
        check.id === 'MISSING_TENANT_ISOLATION'
          ? {...check, findings: check.findings.filter((finding) => finding.suppression)}
          : check,
      ),
    }

    const [alert] = buildSecurityReviewAlerts(
      presenterInput(
        {deterministic: deterministicFindingsDocument, agent},
        {checkIds: ['OPEN_REDIRECT', 'UNSAFE_INNERHTML', 'CREDENTIAL_LOG_LEAKAGE', 'MISSING_TENANT_ISOLATION']},
      ),
    )

    expect(alert!.type).toBe('info')
    expect(alert!.options.headline).toBe('2 checks passed. 1 check not applicable.')
    expect(alert!.options.customSections).toEqual([
      {
        body: {
          tabularData: [
            ['MISSING_TENANT_ISOLATION', 'passed \u00b7 1 finding suppressed'],
            ['UNSAFE_INNERHTML', 'not applicable'],
            ['OPEN_REDIRECT', 'passed'],
          ],
        },
      },
    ])
  })

  test('lists the suppressed findings of passed checks in full with --verbose', () => {
    // With no active findings, MISSING_TENANT_ISOLATION passes; its one finding is suppressed.
    const agent: AgentFindingsDocument = {
      ...agentFindingsDocument,
      checks: agentFindingsDocument.checks.map((check) =>
        check.id === 'MISSING_TENANT_ISOLATION'
          ? {...check, findings: check.findings.filter((finding) => finding.suppression)}
          : check,
      ),
    }
    const sources: Sources = {deterministic: null, agent}

    const [concise] = buildSecurityReviewAlerts(presenterInput(sources, {checkIds: ['MISSING_TENANT_ISOLATION']}))
    const [verbose] = buildSecurityReviewAlerts(
      presenterInput(sources, {checkIds: ['MISSING_TENANT_ISOLATION'], verbose: true}),
    )

    expect(concise!.type).toBe('info')
    expect(concise!.options.customSections).toHaveLength(1)
    expect(verbose!.options.customSections).toHaveLength(2)
    expect(verbose!.options.customSections![1]).toEqual({
      title: 'MISSING_TENANT_ISOLATION \u00b7 agent \u00b7 app/routes/admin.settings.tsx:55 (suppressed)',
      body: [
        'Settings are deleted by id without checking the owning shop.',
        {subdued: '\nConfidence: medium'},
        {subdued: '\nEvidence: app/routes/admin.settings.tsx:55'},
        {subdued: '\nSuppressed: The route is restricted to the app owner by an allowlist middleware.'},
      ],
    })
  })

  test('puts the summary sections in the settled order', () => {
    const alerts = buildSecurityReviewAlerts(presenterInput(both, {checkIds: ['EOL_API_VERSION'], blocking: 'low'}))
    const summary = alerts.at(-1)!

    expect(summary.type).toBe('warning')
    expect(summary.options.headline).toBe('1 check with findings.')
    expect(summary.options.customSections!.map((section) => section.title)).toEqual([
      undefined,
      'Checks with findings',
      undefined,
      undefined,
      `Results files in ${paths.resultsDirectory}`,
      'Blocking',
    ])
    expect(summary.options.customSections![0]!.body).toEqual({subdued: 'Showing 1 of 6 checks (--check-id).'})
    expect(summary.options.customSections![5]!.body).toBe('1 check at or above low (--blocking low).')
  })

  test('puts the stale line after Other checks and before Deterministic coverage', () => {
    const summary = buildSecurityReviewAlerts(presenterInput(staleAgent)).at(-1)!

    const sections = summary.options.customSections!
    expect(sections.map((section) => section.title)).toEqual([
      'Checks with findings',
      'Other checks',
      undefined,
      undefined,
      undefined,
      `Results files in ${paths.resultsDirectory}`,
      'Next steps',
    ])
    expect(sections[2]!.body).toBe(
      '1 check shows both sources because the agent results are older than the deterministic results.',
    )
    expect(sections[3]!.body).toEqual({subdued: expect.stringContaining('Deterministic coverage')})
    expect(sections[4]!.body).toEqual({subdued: expect.stringContaining('Scan directories: .')})
  })
})

describe('renderSecurityReview', () => {
  test('renders the boxes to stderr in order, ending with the summary', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReview(presenterInput(both))

    const rendered = unstyled(output.error() + output.warn() + output.info())
    expect(rendered).toContain('1 check unresolved.')
    expect(rendered).toContain('3 checks with findings. 1 check unresolved.')
    expect(output.error()).toContain('Checks with findings')
    const summaryBox = unstyled(output.error())
    expect(summaryBox).toContain('High  CREDENTIAL_LOG_LEAKAGE    1 agent')
    expect(summaryBox).toContain('Low   EOL_API_VERSION           1 deterministic')
    expect(summaryBox).toContain('1 passed · 1 not applicable · 1 unresolved')
    expect(summaryBox).toContain('Deterministic coverage: 12 files scanned, 1 skipped (1 too large).')
    expect(summaryBox).toContain(`Results files in ${paths.resultsDirectory}`)
    expect(summaryBox).toContain('Updated      Engine')
    expect(summaryBox).toContain('deterministic-findings.json  2 hours ago  3.99.0')
    expect(summaryBox).toContain('agent-findings.json          1 hour ago   3.99.0')
    expect(summaryBox).toContain('Next steps')
    expect(summaryBox).toContain('• Fix the issues, then run `shopify app security check`')
  })

  test('renders an info box with not found rows when no file is present', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReview(presenterInput(none))

    const rendered = unstyled(output.info())
    expect(rendered).toContain('No App Security results to review.')
    expect(rendered).toContain('deterministic-findings.json  not found')
    expect(rendered).toContain('agent-findings.json          not found')
    expect(rendered).toContain(`• Run \`${checkCommand}\` or have your`)
    expect(rendered).toContain('coding agent run it.')
    expect(rendered).not.toContain('Deterministic coverage')
    expect(rendered).not.toContain('--check-id')
    expect(output.error()).toBe('')
    expect(output.warn()).toBe('')
  })

  test('leaves out the next steps section when there is nothing to suggest', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReview(presenterInput(bothWithoutFindings))

    expect(unstyled(output.output())).not.toContain('Next steps')
  })

  test('renders the Blocking section instead of next steps when breached', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReview(presenterInput(both, {blocking: 'high'}))

    const rendered = unstyled(output.error())
    expect(rendered).toContain('Blocking')
    expect(rendered).toContain('2 checks at or above high (--blocking high).')
    expect(rendered).not.toContain('Next steps')
  })
})
