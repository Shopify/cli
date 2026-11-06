import {
  canPromptInteractiveReview,
  interactiveSecurityReview,
  type InteractiveReviewAction,
  type InteractiveReviewDependencies,
} from './security-review-interactive.js'
import {
  buildSecurityReviewAlerts,
  buildSecurityReviewSummary,
  renderSecurityReview,
  type SecurityReviewPresenterInput,
} from './security-review-output.js'
import {
  numberFindings,
  reviewAppSecurityResults,
  type FindingSuppressionResult,
  type InteractiveReviewSession,
  type InteractiveSuppressionRequest,
  type ReattachmentOffer,
} from './security-review.js'
import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {appSecurityResultsFor, type AppSecurityResultsSources} from './app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {Stdin, waitForInputsToBeReady} from '@shopify/cli-kit/node/testing/ui'
import {unstyled} from '@shopify/cli-kit/node/output'
import {cwd} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'
import {EventEmitter} from 'node:events'
import type {
  RenderConfirmationPromptOptions,
  RenderSelectPromptOptions,
  RenderTextPromptOptions,
} from '@shopify/cli-kit/node/ui'
import type {AppSecurityBlockingLevel} from './app-security-api.js'
import type {AppSecuritySuppression, SavedSuppression} from './app-security-suppressions.js'
import type {
  AgentFindingsDocument,
  DeterministicFindingsDocument,
  SuppressionEntry,
  SuppressionEntryResult,
  SuppressionKind,
} from './app-security-engine/index.js'

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
  options: {
    checkIds?: string[]
    blocking?: AppSecurityBlockingLevel
    verbose?: boolean
    /** The entries of shopify.app-security.json. */
    entries?: SuppressionEntry[]
  } = {},
): SecurityReviewPresenterInput {
  const results = appSecurityResultsFor(appRoot, 'shopify.app', sources, options.entries)
  const result = reviewAppSecurityResults(results, {
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
      expect(summary.headline).toBe('No app security check results to review.')
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
          'again.',
          'To refresh agent findings, have your agent run the command and record its findings.',
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
        ['Fix the issues, then run', {command: checkCommand}, 'again.'],
        [
          'Agent results are older than the deterministic results. Have your coding agent run',
          {command: checkCommand},
          'and record its findings again to refresh them.',
        ],
      ])
    })

    test('omits the refresh step when no filtered check is stale', () => {
      const summary = buildSecurityReviewSummary(presenterInput(staleAgent, {checkIds: ['EOL_API_VERSION']}))

      expect(summary.nextSteps).toEqual([expect.arrayContaining(['Fix the issues, then run'])])
    })

    test('offers fixing and a deeper review when the deterministic file alone has findings', () => {
      const summary = buildSecurityReviewSummary(presenterInput(deterministicOnly))

      expect(summary.nextSteps).toEqual([
        ['Fix the issues, then run', {command: checkCommand}, 'again.'],
        'For a deeper review, have your agent run the same command and record its findings.',
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
      ['info', '1 finding suppressed.'],
      ['error', '3 checks with findings. 1 check unresolved.'],
    ])
  })

  describe('suppressed findings', () => {
    const eolEntry: SuppressionEntry = {
      source: 'deterministic',
      check: 'EOL_API_VERSION',
      kind: 'accepted-risk',
      path: 'shopify.app.toml',
      reason: 'The upgrade ships with the next release.',
      configurations: ['shopify.app.toml'],
    }
    const suppressedBox = (input: SecurityReviewPresenterInput) =>
      buildSecurityReviewAlerts(input).find((alert) => String(alert.options.headline).endsWith('suppressed.'))

    test('places suppressed findings before the summary, with severity order and counts, without --verbose', () => {
      const alerts = buildSecurityReviewAlerts(presenterInput(both, {entries: [eolEntry]}))

      expect(alerts.map((alert) => alert.options.headline).slice(-3)).toEqual([
        'High · MISSING_TENANT_ISOLATION · Database query may not be scoped by shop',
        '2 findings suppressed.',
        '2 checks with findings. 1 check unresolved.',
      ])
      const suppressed = alerts.at(-2)!
      expect(suppressed.type).toBe('info')
      expect(suppressed.options.customSections?.map((section) => section.title)).toEqual([
        undefined,
        'High · MISSING_TENANT_ISOLATION · 1 active · 1 suppressed',
        'Low · EOL_API_VERSION · 0 active · 1 suppressed',
        'Entries in shopify.app-security.json',
      ])
      expect(suppressed.options.customSections?.[0]?.body).toBe('2 active · 2 suppressed')
    })

    test('lists only the suppressed findings and the entries of the checks that --check-id selects', () => {
      const box = suppressedBox(presenterInput(both, {entries: [eolEntry], checkIds: ['MISSING_TENANT_ISOLATION']}))

      expect(box?.options.headline).toBe('1 finding suppressed.')
      expect(box?.options.customSections?.map((section) => section.title)).toEqual([
        undefined,
        'High · MISSING_TENANT_ISOLATION · 1 active · 1 suppressed',
      ])
    })

    test('is left out when no shown finding is suppressed, also with entries that match nothing', () => {
      const staleEntry = {...eolEntry, path: 'shopify.app.staging.toml'}

      expect(suppressedBox(presenterInput(bothWithoutFindings))).toBeUndefined()
      expect(
        suppressedBox(presenterInput(both, {checkIds: ['EOL_API_VERSION'], entries: [staleEntry]})),
      ).toBeUndefined()
      expect(
        buildSecurityReviewAlerts(presenterInput(deterministicOnly, {entries: [staleEntry]})).slice(0, -2),
      ).toEqual(buildSecurityReviewAlerts(presenterInput(deterministicOnly)).slice(0, -1))
    })
  })

  describe('entries that apply to nothing', () => {
    function entryResult(
      index: number,
      status: SuppressionEntryResult['status'],
      entry: Partial<SuppressionEntry> = {},
    ): SuppressionEntryResult {
      return {
        index,
        status,
        matched_finding_count: status === 'matched' ? 1 : 0,
        entry: {
          source: 'deterministic',
          check: 'CREDENTIAL_LOG_LEAKAGE',
          kind: 'false-positive',
          path: 'app/routes/orders.tsx',
          reason: 'The token is a placeholder.',
          configurations: ['shopify.app.toml'],
          ...entry,
        },
      }
    }
    const notEvaluatedEntries = (): SuppressionEntryResult[] => [
      {
        ...entryResult(2, 'not-evaluated', {source: 'agent', check: 'UNSAFE_INNERHTML'}),
        not_evaluated_reason: 'no-executed-result',
      },
      {
        ...entryResult(3, 'not-evaluated', {configurations: ['shopify.app.staging.toml']}),
        not_evaluated_reason: 'other-configurations',
      },
    ]
    function inputWithEntries(suppressions: SuppressionEntryResult[], checkIds: string[] = []) {
      const input = presenterInput(both, {checkIds})
      return {...input, result: {...input.result, suppressions}}
    }
    const entriesBox = (input: SecurityReviewPresenterInput) =>
      buildSecurityReviewAlerts(input).find((alert) =>
        String(alert.options.headline).includes('shopify.app-security.json'),
      )

    test('lists stale, ambiguous and not-evaluated entries in a warning before the summary, without --verbose', () => {
      const input = inputWithEntries([
        {
          ...entryResult(0, 'ambiguous'),
          candidate_locations: [
            {file: 'app/routes/orders.tsx', line: 12},
            {file: 'app/routes/orders.tsx', line: 20},
          ],
        },
        {...entryResult(1, 'stale', {path: 'app/routes/old-orders.tsx'}), likely_path: 'app/routes/orders.tsx'},
        ...notEvaluatedEntries(),
      ])

      const alerts = buildSecurityReviewAlerts(input)

      expect(alerts.map((alert) => alert.options.headline).slice(-2)).toEqual([
        '2 entries in shopify.app-security.json suppress nothing.',
        '3 checks with findings. 1 check unresolved.',
      ])
      expect(alerts.at(-2)?.type).toBe('warning')
      expect(alerts.at(-2)?.options.customSections?.map((section) => section.title)).toEqual([
        'Stale entries in shopify.app-security.json',
        undefined,
        'Ambiguous entries in shopify.app-security.json',
        undefined,
        undefined,
      ])
      expect(JSON.stringify(alerts.at(-2))).toContain('suppressions[1]:')
      expect(JSON.stringify(alerts.at(-2))).toContain('suppressions[0]:')
      expect(alerts.at(-2)?.options.customSections?.at(-1)).toEqual({
        body: {
          subdued:
            'Not evaluated: 2 entries (1 for a check without an executed result, 1 for other app configurations).',
        },
      })
    })

    test('shows an info box when every entry that applies to nothing is not evaluated', () => {
      const box = entriesBox(inputWithEntries(notEvaluatedEntries()))

      expect(box).toMatchObject({
        type: 'info',
        options: {headline: '2 entries in shopify.app-security.json not evaluated.'},
      })
      expect(box?.options.customSections).toHaveLength(1)
    })

    test('--check-id narrows the box to the entries of the selected checks', () => {
      const entries = [entryResult(0, 'stale'), ...notEvaluatedEntries()]

      const leakOnly = entriesBox(inputWithEntries(entries, ['CREDENTIAL_LOG_LEAKAGE']))
      const otherCheck = entriesBox(inputWithEntries(entries, ['EOL_API_VERSION']))
      const withoutResult = entriesBox(inputWithEntries(entries, ['UNSAFE_INNERHTML']))

      expect(leakOnly?.options.customSections?.at(-1)).toEqual({
        body: {subdued: 'Not evaluated: 1 entry (1 for other app configurations).'},
      })
      expect(JSON.stringify(leakOnly)).toContain('suppressions[0]:')
      expect(JSON.stringify(leakOnly)).not.toContain('UNSAFE_INNERHTML')
      expect(otherCheck).toBeUndefined()
      expect(withoutResult?.options.headline).toBe('1 entry in shopify.app-security.json not evaluated.')
    })

    test('names the likely finding of a stale entry by its number, with the --suppress command that re-attaches it', () => {
      // An edit of the api_version line made the entry stale: its code is now on no line, but most of its words are.
      const edited: Sources = {
        ...both,
        deterministic: {
          ...deterministicFindingsDocument,
          checks: deterministicFindingsDocument.checks.map((check) =>
            check.id === 'EOL_API_VERSION'
              ? {
                  ...check,
                  findings: check.findings.map((finding) => ({
                    ...finding,
                    message: 'api_version 2024-04 is past its support window.',
                    code_excerpt: [{line: 8, text: 'api_version = "2024-04"'}],
                  })),
                }
              : check,
          ),
        },
      }
      const staleEntry: SuppressionEntry = {
        source: 'deterministic',
        check: 'EOL_API_VERSION',
        kind: 'accepted-risk',
        path: 'shopify.app.toml',
        code: 'api_version = "2024-01"',
        reason: 'The upgrade ships with the next release.',
        configurations: ['shopify.app.toml'],
      }
      const input = presenterInput(edited, {entries: [staleEntry]})
      const reattach = formatAppSecurityCommand({
        ...commands.review,
        args: [...commands.review.args, '--suppress', '6', '--results-digest', input.result.resultsDigest!],
      })

      const box = entriesBox(input)

      expect(reattach).toMatch(/ --suppress 6 --results-digest [0-9a-f]{12}$/)
      expect(box?.options.customSections?.[0]).toEqual({
        title: 'Stale entries in shopify.app-security.json',
        body: {
          list: {
            items: [
              [
                {subdued: 'suppressions[0]:'},
                'deterministic EOL_API_VERSION in',
                {filePath: 'shopify.app.toml'},
                {subdued: '· accepted risk'},
                '\nThe upgrade ships with the next release.',
                '\nLikely now finding 6, at',
                {filePath: 'shopify.app.toml:8'},
                {char: '.'},
                'To re-attach the entry to it, with its kind and reason, run',
                {command: reattach},
              ],
            ],
          },
        },
      })
    })

    test('is left out without a file, and when every entry matched', () => {
      expect(entriesBox(inputWithEntries([]))).toBeUndefined()
      expect(entriesBox(inputWithEntries([entryResult(0, 'matched')]))).toBeUndefined()
    })
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
        // Numbers count the findings of every check, so --check-id keeps them.
        title: '#5 · agent · app/routes/orders.tsx:31',
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
      '#1 \u00b7 deterministic \u00b7 app/routes/orders.tsx:12',
      '#2 \u00b7 agent \u00b7 app/routes/orders.tsx:12',
      '#3 \u00b7 deterministic \u00b7 app/shopify.server.ts:40',
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
        title: '#3 · deterministic · shopify.app.toml:8',
        body: [
          'api_version 2024-01 is past its support window.',
          {subdued: '\nFix: Update api_version in shopify.app.toml and the ApiVersion enum in shopify.server.ts.'},
          {subdued: '\nGuide: https://shopify.dev/docs/api/usage/versioning'},
        ],
      },
    ])
  })

  test("links the check's docs page from its box", () => {
    const docsUrl = 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version'
    const deterministic = {
      ...deterministicFindingsDocument,
      checks: deterministicFindingsDocument.checks.map((check) =>
        check.id === 'EOL_API_VERSION' ? {...check, snapshot: {...check.snapshot, docs_url: docsUrl}} : check,
      ),
    }
    const [alert] = buildSecurityReviewAlerts(
      presenterInput({deterministic, agent: null}, {checkIds: ['EOL_API_VERSION']}),
    )

    expect(alert!.options.link).toEqual({label: 'EOL_API_VERSION on shopify.dev', url: docsUrl})
  })

  test('leaves out the docs link when the results file predates check docs pages', () => {
    const [alert] = buildSecurityReviewAlerts(presenterInput(deterministicOnly, {checkIds: ['EOL_API_VERSION']}))

    expect(alert!.options.link).toBeUndefined()
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
      '#4 · agent · app/routes/admin.settings.tsx:55 (suppressed)',
      '#5 · agent · app/routes/orders.tsx:31',
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
        title: '#3 · deterministic · shopify.app.toml:8',
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
      'CREDENTIAL_LOG_LEAKAGE \u00b7 #1 \u00b7 deterministic \u00b7 app/routes/orders.tsx:12 (superseded)',
      'CREDENTIAL_LOG_LEAKAGE \u00b7 #2 \u00b7 agent \u00b7 app/routes/orders.tsx:12 (suppressed)',
      'CREDENTIAL_LOG_LEAKAGE \u00b7 #3 \u00b7 deterministic \u00b7 app/shopify.server.ts:40 (superseded)',
    ])
    expect(sections[1]!.body).toContainEqual({
      subdued: '\nEvidence: app/routes/orders.tsx:12 \u2014 console.log(session.accessToken)',
    })
    expect(sections[2]).toEqual({
      title: 'CREDENTIAL_LOG_LEAKAGE \u00b7 #2 \u00b7 agent \u00b7 app/routes/orders.tsx:12 (suppressed)',
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
      title: 'MISSING_TENANT_ISOLATION \u00b7 #2 \u00b7 agent \u00b7 app/routes/admin.settings.tsx:55 (suppressed)',
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
      undefined,
      'Blocking',
    ])
    expect(summary.options.customSections![0]!.body).toEqual({subdued: 'Showing 1 of 6 checks (--check-id).'})
    expect(summary.options.customSections![5]!.body).toEqual({
      subdued: expect.stringMatching(/^Results digest: [0-9a-f]{12} \(pass it to --results-digest with --suppress\)$/),
    })
    expect(summary.options.customSections![6]!.body).toBe('1 check at or above low (--blocking low).')
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
      undefined,
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

  test('renders the number of each finding before its source, and the results digest in the summary', () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const input = presenterInput(both)

    renderSecurityReview(input)

    const rendered = unstyled(output.error() + output.warn() + output.info())
    expect(rendered).toContain('#2 · agent · app/routes/orders.tsx:12')
    expect(rendered).toContain('#6 · deterministic · shopify.app.toml:8')
    expect(rendered.replace(/[│\s]+/g, ' ')).toContain(
      `Results digest: ${input.result.resultsDigest} (pass it to --results-digest with --suppress)`,
    )
  })

  test('renders what --suppress saved after the summary, the companions it left out, and to review and commit the file', () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const entry: AppSecuritySuppression = {
      source: 'agent',
      check: 'CREDENTIAL_LOG_LEAKAGE',
      kind: 'false-positive',
      path: 'app/routes/orders.tsx',
      code: 'console.log(session.accessToken)',
      reason: 'The logger redacts tokens.',
      configurations: ['shopify.app.toml', 'shopify.app.staging.toml'],
    }
    const input: SecurityReviewPresenterInput = {
      ...presenterInput(both),
      savedSuppressions: {
        path: `${appRoot}/shopify.app-security.json`,
        saved: [{index: 3, change: 'added', entry, findingNumber: 2}],
        companionNumbers: [1],
      },
    }

    renderSecurityReview(input)

    const alerts = buildSecurityReviewAlerts(input)
    expect(alerts.at(-2)!.options.headline).toBe('3 checks with findings. 1 check unresolved.')
    expect(alerts.at(-1)!.type).toBe('success')
    const rendered = unstyled(output.info()).replace(/[│\s]+/g, ' ')
    expect(rendered).toContain('Saved 1 suppression to shopify.app-security.json.')
    expect(rendered).toContain(
      'suppressions[3] · finding 2 · added agent CREDENTIAL_LOG_LEAKAGE in app/routes/orders.tsx Kind: false positive Code: console.log(session.accessToken) Reason: The logger redacts tokens. Configurations: shopify.app.toml, shopify.app.staging.toml',
    )
    expect(rendered).toContain(
      'Not suppressed Finding 1 is a superseded deterministic finding of the same check in the same file, so check --blocking, which reads no agent results, still counts it. To suppress it with the same kind and reason, run the command again with --include-superseded.',
    )
    expect(rendered).toContain('Next steps • Review and commit shopify.app-security.json.')
    // Finding 2 is active, so its entry needs no word about check --blocking.
    expect(rendered).not.toContain('The agent result supersedes')
  })

  test('renders a re-attached entry with its old and new code, and the kind and reason it kept or replaced', () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const entry: AppSecuritySuppression = {
      source: 'deterministic',
      check: 'EOL_API_VERSION',
      kind: 'accepted-risk',
      path: 'shopify.app.toml',
      code: 'api_version = "2024-04"',
      reason: 'The upgrade ships with the next release.',
      configurations: ['shopify.app.toml'],
    }
    const savedSuppressions = (previous: NonNullable<SavedSuppression['previous']>) => ({
      path: `${appRoot}/shopify.app-security.json`,
      saved: [{index: 0, change: 'code-replaced' as const, entry, previous, findingNumber: 6}],
      companionNumbers: [],
    })

    renderSecurityReview({
      ...presenterInput(both),
      savedSuppressions: savedSuppressions({code: 'api_version = "2024-01"', kind: entry.kind, reason: entry.reason}),
    })
    const kept = unstyled(output.info()).replace(/[│\s]+/g, ' ')
    output.clear()
    renderSecurityReview({
      ...presenterInput(both),
      savedSuppressions: savedSuppressions({
        code: 'api_version = "2024-01"',
        kind: 'false-positive',
        reason: 'Not a real app.',
      }),
    })
    const replaced = unstyled(output.info()).replace(/[│\s]+/g, ' ')

    expect(kept).toContain(
      'Saved 1 suppression to shopify.app-security.json. suppressions[0] · finding 6 · re-attached deterministic EOL_API_VERSION in shopify.app.toml Kind: accepted risk (kept) Old code: api_version = "2024-01" New code: api_version = "2024-04" Reason (kept): The upgrade ships with the next release. Configurations: shopify.app.toml',
    )
    expect(replaced).toContain(
      'Kind: accepted risk (replaced, it was false positive) Old code: api_version = "2024-01" New code: api_version = "2024-04" Reason (replaced): The upgrade ships with the next release. Old reason: Not a real app. Configurations: shopify.app.toml',
    )
    expect(kept).toContain('Next steps • Review and commit shopify.app-security.json.')
  })

  test('says that check --blocking counts a saved superseded finding, which is why it has an entry', () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const input: SecurityReviewPresenterInput = {
      ...presenterInput(both),
      savedSuppressions: {
        path: `${appRoot}/shopify.app-security.json`,
        saved: [{index: 0, change: 'added', entry: serverLogEntry, findingNumber: 3}],
        companionNumbers: [],
      },
    }

    renderSecurityReview(input)

    const [entrySection] = buildSecurityReviewAlerts(input).at(-1)!.options.customSections!
    expect(entrySection!.body).toContainEqual(
      '\nThe agent result supersedes finding 3 in the review, but check --blocking, which reads no agent results, counts it. This entry suppresses it for check --blocking.',
    )
    expect(unstyled(output.info()).replace(/[│\s]+/g, ' ')).toContain(
      'suppressions[0] · finding 3 · added deterministic CREDENTIAL_LOG_LEAKAGE in app/shopify.server.ts Kind: accepted risk Code: logger.info(apiSecretKey) Reason: The logger drops secrets. Configurations: shopify.app.toml The agent result supersedes finding 3 in the review, but check --blocking, which reads no agent results, counts it. This entry suppresses it for check --blocking.',
    )
  })

  test('names several companions and an entry that got a configuration', () => {
    const entry: AppSecuritySuppression = {
      source: 'deterministic',
      check: 'EOL_API_VERSION',
      kind: 'accepted-risk',
      path: 'shopify.app.toml',
      reason: 'Later.',
      configurations: ['shopify.app.staging.toml', 'shopify.app.toml'],
    }
    const alert = buildSecurityReviewAlerts({
      ...presenterInput(both),
      savedSuppressions: {
        path: `${appRoot}/shopify.app-security.json`,
        saved: [{index: 0, change: 'configuration-added', entry, findingNumber: 6}],
        companionNumbers: [1, 3, 7],
      },
    }).at(-1)!

    expect(alert.options.customSections!.map((section) => section.title)).toStrictEqual([
      'suppressions[0] · finding 6 · configuration added',
      'Not suppressed',
      'Next steps',
    ])
    expect(alert.options.customSections![0]!.body).not.toContainEqual({subdued: expect.stringContaining('Code:')})
    expect(alert.options.customSections![1]!.body).toEqual(
      expect.stringMatching(
        /^Findings 1, 3 and 7 are superseded deterministic findings of .* still counts them\. To suppress them /,
      ),
    )
  })

  test('renders each suppressed finding with its kind and reason without --verbose', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReview(presenterInput(both))

    const rendered = unstyled(output.info())
      .replaceAll(/[│╭╮╰╯─]/g, ' ')
      .replace(/\s+/g, ' ')
    expect(rendered).toContain('1 finding suppressed. 3 active · 1 suppressed')
    expect(rendered).toContain(
      'High · MISSING_TENANT_ISOLATION · 1 active · 1 suppressed • app/routes/admin.settings.tsx:55 · agent · suppressed by the agent The route is restricted to the app owner by an allowlist middleware.',
    )
  })

  test('renders an info box with not found rows when no file is present', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderSecurityReview(presenterInput(none))

    const rendered = unstyled(output.info())
    expect(rendered).toContain('No app security check results to review.')
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

/** An entry for finding 2, the active agent CREDENTIAL_LOG_LEAKAGE finding of the shared fixtures. */
const credentialEntry: AppSecuritySuppression = {
  source: 'agent',
  check: 'CREDENTIAL_LOG_LEAKAGE',
  kind: 'false-positive',
  path: 'app/routes/orders.tsx',
  code: 'console.log(session.accessToken)',
  reason: 'The logger redacts tokens.',
  configurations: ['shopify.app.toml'],
}
/** The entry for finding 1, its superseded deterministic companion. */
const companionEntry: AppSecuritySuppression = {...credentialEntry, source: 'deterministic'}
/** An entry for finding 3, a superseded deterministic finding in a file where the agent result has no finding. */
const serverLogEntry: AppSecuritySuppression = {
  source: 'deterministic',
  check: 'CREDENTIAL_LOG_LEAKAGE',
  kind: 'accepted-risk',
  path: 'app/shopify.server.ts',
  code: 'logger.info(apiSecretKey)',
  reason: 'The logger drops secrets.',
  configurations: ['shopify.app.toml'],
}
const eolApiVersionEntry: AppSecuritySuppression = {
  source: 'deterministic',
  check: 'EOL_API_VERSION',
  kind: 'accepted-risk',
  path: 'shopify.app.toml',
  code: 'api_version = "2024-01"',
  reason: 'The upgrade ships with the next release.',
  configurations: ['shopify.app.toml'],
}

function savedResult(
  saved: {index: number; entry: AppSecuritySuppression; findingNumber: number}[],
  companionNumbers: number[] = [],
): FindingSuppressionResult {
  return {
    status: 'saved',
    savedSuppressions: {
      path: `${appRoot}/shopify.app-security.json`,
      saved: saved.map((savedEntry) => ({...savedEntry, change: 'added' as const})),
      companionNumbers,
    },
  }
}

const notSuppressible: FindingSuppressionResult = {
  status: 'refused',
  refusal: {
    code: 'finding-not-suppressible',
    message:
      "Finding 5 can't be suppressed: the results hold no code for its line, so no automatic code selector is available. Nothing was saved.",
    tryMessage: 'Add an entry for it to shopify.app-security.json by hand, with a code that names it alone.',
    details: {findingNumber: 5},
  },
}

const resultsChanged: FindingSuppressionResult = {
  status: 'refused',
  refusal: {
    code: 'results-digest-mismatch',
    message:
      'The results changed since digest 0123456789ab, so the finding numbers may name other findings. Nothing was saved.',
    tryMessage: 'Run the review again, check the number of the finding, and pass the new digest with --results-digest.',
    details: {resultsDigest: 'ba9876543210'},
  },
}

/**
 * A session over the shared fixtures, whose active findings are 2 (high), 5 (high) and 6 (low), and whose superseded
 * findings that check --blocking counts are 1 and 3 (both high, CREDENTIAL_LOG_LEAKAGE). `suppress` answers each request
 * with the next of `answers`.
 */
function interactiveSession(
  answers: FindingSuppressionResult[] = [],
  options: {reattachments?: ReadonlyMap<number, ReattachmentOffer>} = {},
) {
  const {result} = presenterInput(both)
  const numbered = numberFindings(result.allChecks)
  const queue = [...answers]
  const nextAnswer = () => {
    const answer = queue.shift()
    if (!answer) throw new Error('Unexpected save')
    return answer
  }
  return {
    result,
    configuration: 'shopify.app.toml',
    findings: numbered.filter(({finding}) => finding.disposition === 'active'),
    supersededFindings: numbered.filter(
      ({finding}) => finding.disposition === 'superseded' && finding.suppressed_by === undefined,
    ),
    suppress: vi.fn(async (_request: InteractiveSuppressionRequest) => nextAnswer()),
    reattachments: options.reattachments ?? new Map(),
    reattach: vi.fn(async (_findingNumber: number) => nextAnswer()),
  } satisfies InteractiveReviewSession
}

/** Prompts that answer with the next scripted answer, and fail the test on a prompt that has no answer left. */
function scriptedPrompts(answers: {
  actions: InteractiveReviewAction[]
  kinds?: SuppressionKind[]
  reasons?: string[]
  companions?: boolean[]
}) {
  const next = <T>(queue: T[], prompt: string): T => {
    if (queue.length === 0) throw new Error(`Unexpected prompt: ${prompt}`)
    return queue.shift()!
  }
  const actions = [...answers.actions]
  const kinds = [...(answers.kinds ?? [])]
  const reasons = [...(answers.reasons ?? [])]
  const companions = [...(answers.companions ?? [])]
  return {
    canPrompt: () => true,
    selectAction: vi.fn(async (prompt: RenderSelectPromptOptions<InteractiveReviewAction>) =>
      next(actions, String(prompt.message)),
    ),
    selectKind: vi.fn(async (prompt: RenderSelectPromptOptions<SuppressionKind>) =>
      next(kinds, String(prompt.message)),
    ),
    enterReason: vi.fn(async (prompt: RenderTextPromptOptions) => next(reasons, String(prompt.message))),
    confirmCompanions: vi.fn(async (prompt: RenderConfirmationPromptOptions) =>
      next(companions, String(prompt.message)),
    ),
  } satisfies InteractiveReviewDependencies
}

function promptMessages(prompt: {mock: {calls: [{message: unknown}][]}}): string[] {
  return prompt.mock.calls.map(([options]) => String(options.message))
}

describe('canPromptInteractiveReview', () => {
  const streams = [process.stdin, process.stdout, process.stderr]

  /** Runs `check` with stdin, stdout and stderr reporting these TTY values, then restores them. */
  function withTTYs<T>(ttys: [boolean, boolean, boolean], check: () => T): T {
    const original = streams.map((stream) => Object.getOwnPropertyDescriptor(stream, 'isTTY'))
    streams.forEach((stream, index) => Object.defineProperty(stream, 'isTTY', {value: ttys[index], configurable: true}))
    try {
      return check()
    } finally {
      streams.forEach((stream, index) => {
        const descriptor = original[index]
        if (descriptor) Object.defineProperty(stream, 'isTTY', descriptor)
        else Reflect.deleteProperty(stream, 'isTTY')
      })
    }
  }

  test('is true only when stdin, stdout and stderr are terminals, outside CI and without --no-input', () => {
    vi.stubEnv('CI', undefined)
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', undefined)
    vi.stubEnv('TERM', 'xterm-256color')
    try {
      expect(withTTYs([true, true, true], canPromptInteractiveReview)).toBe(true)
      expect(withTTYs([false, true, true], canPromptInteractiveReview)).toBe(false)
      expect(withTTYs([true, false, true], canPromptInteractiveReview)).toBe(false)
      expect(withTTYs([true, true, false], canPromptInteractiveReview)).toBe(false)

      vi.stubEnv('CI', 'true')
      expect(withTTYs([true, true, true], canPromptInteractiveReview)).toBe(false)

      vi.stubEnv('CI', undefined)
      vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
      expect(withTTYs([true, true, true], canPromptInteractiveReview)).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('interactiveSecurityReview', () => {
  test('aborts before anything is read or prompted when the terminal cannot prompt', () => {
    const prompts = {...scriptedPrompts({actions: []}), canPrompt: () => false}

    expect(() => interactiveSecurityReview(prompts)).toThrow(
      expect.objectContaining({
        message: 'The interactive review needs an interactive terminal.',
        code: 'interactive-review-unavailable',
        tryMessage: expect.stringContaining('pass its number to --suppress with --kind and --reason'),
      }),
    )
    expect(prompts.selectAction).not.toHaveBeenCalled()
  })

  test('shows each active finding in full with its number, most severe first, and offers Suppress, Continue and Quit', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const session = {...interactiveSession(), supersededFindings: []}
    const prompts = scriptedPrompts({actions: ['continue', 'continue', 'continue']})

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(outcome).toStrictEqual({saved: [], declinedCompanions: [], ending: 'finished'})
    expect(promptMessages(prompts.selectAction)).toStrictEqual([
      'What do you want to do with finding #2?',
      'What do you want to do with finding #5?',
      'What do you want to do with finding #6?',
    ])
    expect(prompts.selectAction.mock.calls[0]![0].choices).toStrictEqual([
      {label: 'Suppress', value: 'suppress', key: 's'},
      {label: 'Continue', value: 'continue', key: 'c'},
      {label: 'Quit', value: 'quit', key: 'q'},
    ])
    expect(session.suppress).not.toHaveBeenCalled()
    const rendered = unstyled(output.info() + output.warn() + output.error()).replace(/[│\s]+/g, ' ')
    expect(rendered).toContain(
      'Reviewing 3 active findings for shopify.app.toml, most severe first. For each finding, choose Suppress to save an entry for it to shopify.app-security.json at once, Continue to leave it active, or Quit to stop.',
    )
    expect(rendered).toContain(
      'High · CREDENTIAL_LOG_LEAKAGE · Credential reaches a log sink Active finding 1 of 3 #2 · agent · app/routes/orders.tsx:12 The session access token is written to the server log.',
    )
    // In full, as with --verbose: with the evidence.
    expect(rendered).toContain('Evidence: app/routes/orders.tsx:12 — console.log(session.accessToken)')
    expect(rendered).toContain('Active finding 3 of 3 #6 · deterministic · shopify.app.toml:8')
  })

  test('suppresses a finding with its kind and reason, saved at once, then goes on', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const session = interactiveSession([savedResult([{index: 0, entry: eolApiVersionEntry, findingNumber: 6}])])
    const prompts = scriptedPrompts({
      actions: ['continue', 'continue', 'suppress', 'continue', 'continue'],
      kinds: ['accepted-risk'],
      reasons: ['The upgrade ships with the next release.'],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(session.suppress).toHaveBeenCalledExactlyOnceWith({
      findingNumber: 6,
      decision: {kind: 'accepted-risk', reason: 'The upgrade ships with the next release.'},
      includeSuperseded: false,
    })
    expect(outcome).toStrictEqual({
      saved: [{index: 0, change: 'added', entry: eolApiVersionEntry, findingNumber: 6}],
      declinedCompanions: [],
      ending: 'finished',
    })
    expect(promptMessages(prompts.selectKind)).toStrictEqual(['Is finding #6 a false positive or an accepted risk?'])
    expect(prompts.selectKind.mock.calls[0]![0].choices).toStrictEqual([
      {label: 'False positive: the finding is wrong', value: 'false-positive'},
      {label: 'Accepted risk: the finding is real, and you accept the risk', value: 'accepted-risk'},
    ])
    expect(promptMessages(prompts.enterReason)).toStrictEqual(['Why should finding #6 be suppressed?'])
    const rendered = unstyled(output.info()).replace(/[│\s]+/g, ' ')
    expect(rendered).toContain(
      'Saved 1 suppression to shopify.app-security.json. suppressions[0] · finding 6 · added deterministic EOL_API_VERSION in shopify.app.toml Kind: accepted risk Code: api_version = "2024-01" Reason: The upgrade ships with the next release. Configurations: shopify.app.toml',
    )
  })

  test('offers Re-attach for the likely finding of a stale entry, and re-attaches it with its kind and reason', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const staleEntry = {...eolApiVersionEntry, code: 'api_version = "2023-10"'}
    const reattached = {
      status: 'saved',
      savedSuppressions: {
        path: `${appRoot}/shopify.app-security.json`,
        saved: [
          {
            index: 0,
            change: 'code-replaced',
            entry: eolApiVersionEntry,
            previous: {code: 'api_version = "2023-10"', kind: staleEntry.kind, reason: staleEntry.reason},
            findingNumber: 6,
          },
        ],
        companionNumbers: [],
      },
    } as const satisfies FindingSuppressionResult
    const session = interactiveSession([reattached], {
      reattachments: new Map([[6, {entryIndex: 0, entry: staleEntry, code: 'api_version = "2024-01"'}]]),
    })
    const prompts = scriptedPrompts({actions: ['continue', 'continue', 'reattach', 'quit']})

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(session.reattach).toHaveBeenCalledExactlyOnceWith(6)
    expect(session.suppress).not.toHaveBeenCalled()
    expect(prompts.selectKind).not.toHaveBeenCalled()
    expect(prompts.enterReason).not.toHaveBeenCalled()
    expect(outcome).toStrictEqual({saved: reattached.savedSuppressions.saved, declinedCompanions: [], ending: 'quit'})
    const choices = prompts.selectAction.mock.calls.map(([prompt]) => prompt.choices.map(({label}) => label))
    expect(choices[0]).toStrictEqual(['Suppress', 'Continue', 'Quit'])
    expect(choices[2]).toStrictEqual(['Re-attach suppressions[0]', 'Suppress', 'Continue', 'Quit'])
    expect(prompts.selectAction.mock.calls[2]![0].choices[0]).toMatchObject({value: 'reattach', key: 'r'})
    const rendered = unstyled(output.info()).replace(/[│\s]+/g, ' ')
    const findingBox = unstyled(output.warn()).replace(/[│\s]+/g, ' ')
    expect(rendered).toContain('you can also choose Re-attach')
    expect(findingBox).toContain(
      'Stale entry suppressions[0] · accepted risk Its code matches no finding, and the code of this finding is similar. Re-attach gives the entry this finding\'s code, and keeps its kind and reason. Reason: The upgrade ships with the next release. Old code: api_version = "2023-10" New code: api_version = "2024-01"',
    )
    expect(rendered).toContain(
      'suppressions[0] · finding 6 · re-attached deterministic EOL_API_VERSION in shopify.app.toml Kind: accepted risk (kept) Old code: api_version = "2023-10" New code: api_version = "2024-01" Reason (kept): The upgrade ships with the next release.',
    )
  })

  test('re-attaches an agent entry, then asks for its companions with the kind and reason the entry kept', async () => {
    mockAndCaptureOutput()
    const staleEntry = {...credentialEntry, code: 'console.log(session.idToken)'}
    const session = interactiveSession(
      [
        savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}], [1]),
        savedResult([{index: 1, entry: companionEntry, findingNumber: 1}]),
      ],
      {reattachments: new Map([[2, {entryIndex: 0, entry: staleEntry, code: 'console.log(session.accessToken)'}]])},
    )
    const prompts = scriptedPrompts({actions: ['reattach', 'quit'], companions: [true]})

    await interactiveSecurityReview(prompts)(session)

    expect(session.reattach).toHaveBeenCalledExactlyOnceWith(2)
    expect(session.suppress).toHaveBeenCalledExactlyOnceWith({
      findingNumber: 2,
      decision: {kind: 'false-positive', reason: 'The logger redacts tokens.'},
      includeSuperseded: true,
    })
  })

  test('requires a reason: the reason prompt refuses an empty one, and one that is too long', async () => {
    mockAndCaptureOutput()
    const prompts = scriptedPrompts({actions: ['suppress', 'quit'], kinds: ['false-positive'], reasons: ['Redacted.']})
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}])])

    await interactiveSecurityReview(prompts)(session)

    const validate = prompts.enterReason.mock.calls[0]![0].validate!
    expect(validate('')).toBe('The reason must not be empty.')
    expect(validate('   ')).toBe('The reason must not be empty.')
    expect(validate('x'.repeat(4_001))).toBe('The reason must be at most 4000 characters.')
    expect(validate('Redacted.')).toBeUndefined()
  })

  test('quits at once and keeps what was saved before', async () => {
    mockAndCaptureOutput()
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}])])
    const prompts = scriptedPrompts({
      actions: ['suppress', 'quit'],
      kinds: ['false-positive'],
      reasons: ['The logger redacts tokens.'],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    const [saveOrder] = session.suppress.mock.invocationCallOrder
    const [, secondOffer] = prompts.selectAction.mock.invocationCallOrder
    expect(saveOrder).toBeLessThan(secondOffer!)
    expect(outcome).toStrictEqual({
      saved: [{index: 0, change: 'added', entry: credentialEntry, findingNumber: 2}],
      declinedCompanions: [],
      ending: 'quit',
    })
    expect(promptMessages(prompts.selectAction)).toStrictEqual([
      'What do you want to do with finding #2?',
      'What do you want to do with finding #5?',
    ])
  })

  test('asks a separate question for the companions, and saves them only after a yes', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const session = interactiveSession([
      savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}], [1]),
      savedResult([{index: 1, entry: companionEntry, findingNumber: 1}]),
    ])
    const prompts = scriptedPrompts({
      actions: ['suppress', 'quit'],
      kinds: ['false-positive'],
      reasons: ['The logger redacts tokens.'],
      companions: [true],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(prompts.confirmCompanions).toHaveBeenCalledExactlyOnceWith({
      message:
        'Finding #1 is a superseded deterministic finding of CREDENTIAL_LOG_LEAKAGE in app/routes/orders.tsx, and check --blocking, which reads no agent results, still counts it. Suppress it too, with the same kind and reason?',
      confirmationMessage: 'Yes, suppress it too',
      cancellationMessage: 'No',
      defaultValue: false,
    })
    const decision = {kind: 'false-positive', reason: 'The logger redacts tokens.'}
    expect(session.suppress.mock.calls).toStrictEqual([
      [{findingNumber: 2, decision, includeSuperseded: false}],
      [{findingNumber: 2, decision, includeSuperseded: true}],
    ])
    // The agent entry is saved before the question.
    expect(session.suppress.mock.invocationCallOrder[0]).toBeLessThan(
      prompts.confirmCompanions.mock.invocationCallOrder[0]!,
    )
    expect(outcome.saved.map(({index, findingNumber}) => [index, findingNumber])).toStrictEqual([
      [0, 2],
      [1, 1],
    ])
    expect(outcome.declinedCompanions).toStrictEqual([])
    expect(unstyled(output.info()).replace(/[│\s]+/g, ' ')).toContain(
      'Saved 1 suppression to shopify.app-security.json. suppressions[1] · finding 1 · added deterministic CREDENTIAL_LOG_LEAKAGE',
    )
  })

  test('names several companions in one question', async () => {
    mockAndCaptureOutput()
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}], [1, 3])])
    const prompts = scriptedPrompts({
      actions: ['suppress', 'quit'],
      kinds: ['false-positive'],
      reasons: ['The logger redacts tokens.'],
      companions: [false],
    })

    await interactiveSecurityReview(prompts)(session)

    expect(prompts.confirmCompanions.mock.calls[0]![0]).toMatchObject({
      message: expect.stringMatching(
        /^Findings #1 and #3 are superseded deterministic findings of .* still counts them\. Suppress them too, with the same kind and reason\?$/,
      ),
      confirmationMessage: 'Yes, suppress them too',
    })
  })

  test('leaves the companions active after a no, and returns them as declined', async () => {
    mockAndCaptureOutput()
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}], [1])])
    const prompts = scriptedPrompts({
      actions: ['suppress', 'continue', 'continue', 'continue'],
      kinds: ['false-positive'],
      reasons: ['The logger redacts tokens.'],
      companions: [false],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(session.suppress).toHaveBeenCalledOnce()
    // The session asked about finding 1 as a companion already, so it offers only finding 3 after the active findings.
    expect(promptMessages(prompts.selectAction).slice(3)).toStrictEqual(['What do you want to do with finding #3?'])
    expect(outcome).toStrictEqual({
      saved: [{index: 0, change: 'added', entry: credentialEntry, findingNumber: 2}],
      declinedCompanions: [{findingNumber: 2, companionNumbers: [1]}],
      ending: 'finished',
    })
  })

  test('shows a refusal, saves nothing for that finding, and goes on to the next one', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const session = {...interactiveSession([notSuppressible]), supersededFindings: []}
    const prompts = scriptedPrompts({
      actions: ['continue', 'suppress', 'continue'],
      kinds: ['accepted-risk'],
      reasons: ['Kept until the migration ships.'],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(outcome).toStrictEqual({saved: [], declinedCompanions: [], ending: 'finished'})
    expect(promptMessages(prompts.selectAction).at(-1)).toBe('What do you want to do with finding #6?')
    expect(unstyled(output.warn()).replace(/[│\s]+/g, ' ')).toContain(
      "Finding 5 can't be suppressed: the results hold no code for its line, so no automatic code selector is available. Nothing was saved. Add an entry for it to shopify.app-security.json by hand",
    )
  })

  test('stops when the results changed since the session started', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const session = interactiveSession([resultsChanged])
    const prompts = scriptedPrompts({
      actions: ['suppress'],
      kinds: ['false-positive'],
      reasons: ['The logger redacts tokens.'],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(outcome).toStrictEqual({saved: [], declinedCompanions: [], ending: 'results-changed'})
    expect(prompts.selectAction).toHaveBeenCalledOnce()
    expect(unstyled(output.error()).replace(/[│\s]+/g, ' ')).toContain(
      'The results changed since digest 0123456789ab, so the finding numbers may name other findings. Nothing was saved. The review stops here, and the suppressions you saved before are kept.',
    )
  })

  test('after the active findings, offers the superseded findings that check --blocking still counts, and says why', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const session = interactiveSession()
    const prompts = scriptedPrompts({actions: ['continue', 'continue', 'continue', 'continue', 'continue']})

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(outcome).toStrictEqual({saved: [], declinedCompanions: [], ending: 'finished'})
    expect(promptMessages(prompts.selectAction)).toStrictEqual(
      [2, 5, 6, 1, 3].map((number) => `What do you want to do with finding #${number}?`),
    )
    expect(session.suppress).not.toHaveBeenCalled()
    const info = unstyled(output.info()).replace(/[│\s]+/g, ' ')
    expect(info).toContain(
      "Reviewing 2 superseded findings that check --blocking still counts. An agent result supersedes these deterministic findings, so the review doesn't count them. But check --blocking, which reads no agent results, still counts them, so a CI gate that runs it can fail. Choose Suppress, Continue or Quit for each finding, as before.",
    )
    expect(info.indexOf('Reviewing 2 superseded findings')).toBeGreaterThan(info.indexOf('Reviewing 3 active findings'))
    expect(unstyled(output.error()).replace(/[│\s]+/g, ' ')).toContain(
      'High · CREDENTIAL_LOG_LEAKAGE · Credential reaches a log sink Superseded finding 1 of 2 #1 · deterministic · app/routes/orders.tsx:12 (superseded) accessToken flows into console.log.',
    )
  })

  test('suppresses a superseded finding with its kind and reason, and says that check --blocking counts it', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const session = interactiveSession([savedResult([{index: 0, entry: serverLogEntry, findingNumber: 3}])])
    const prompts = scriptedPrompts({
      actions: ['continue', 'continue', 'continue', 'continue', 'suppress'],
      kinds: ['accepted-risk'],
      reasons: ['The logger drops secrets.'],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(session.suppress).toHaveBeenCalledExactlyOnceWith({
      findingNumber: 3,
      decision: {kind: 'accepted-risk', reason: 'The logger drops secrets.'},
      includeSuperseded: false,
    })
    expect(outcome).toStrictEqual({
      saved: [{index: 0, change: 'added', entry: serverLogEntry, findingNumber: 3}],
      declinedCompanions: [],
      ending: 'finished',
    })
    expect(promptMessages(prompts.selectKind)).toStrictEqual(['Is finding #3 a false positive or an accepted risk?'])
    expect(prompts.confirmCompanions).not.toHaveBeenCalled()
    expect(unstyled(output.info()).replace(/[│\s]+/g, ' ')).toContain(
      'Saved 1 suppression to shopify.app-security.json. suppressions[0] · finding 3 · added deterministic CREDENTIAL_LOG_LEAKAGE in app/shopify.server.ts Kind: accepted risk Code: logger.info(apiSecretKey) Reason: The logger drops secrets. Configurations: shopify.app.toml The agent result supersedes finding 3 in the review, but check --blocking, which reads no agent results, counts it.',
    )
  })

  test('does not offer a superseded finding again that the session saved as a companion', async () => {
    mockAndCaptureOutput()
    const session = interactiveSession([
      savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}], [1]),
      savedResult([{index: 1, entry: companionEntry, findingNumber: 1}]),
    ])
    const prompts = scriptedPrompts({
      actions: ['suppress', 'continue', 'continue', 'continue'],
      kinds: ['false-positive'],
      reasons: ['The logger redacts tokens.'],
      companions: [true],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(promptMessages(prompts.selectAction)).toStrictEqual(
      [2, 5, 6, 3].map((number) => `What do you want to do with finding #${number}?`),
    )
    expect(outcome.ending).toBe('finished')
  })

  test('does not offer a superseded finding again that the session declined as a companion', async () => {
    mockAndCaptureOutput()
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}], [1])])
    const prompts = scriptedPrompts({
      actions: ['suppress', 'continue', 'continue', 'continue'],
      kinds: ['false-positive'],
      reasons: ['The logger redacts tokens.'],
      companions: [false],
    })

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(promptMessages(prompts.selectAction)).toStrictEqual(
      [2, 5, 6, 3].map((number) => `What do you want to do with finding #${number}?`),
    )
    expect(session.suppress).toHaveBeenCalledTimes(1)
    expect(outcome.declinedCompanions).toStrictEqual([{findingNumber: 2, companionNumbers: [1]}])
    expect(outcome.ending).toBe('finished')
  })

  test('offers the superseded findings when no finding is active', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const full = interactiveSession()
    const session = {...full, findings: [], supersededFindings: full.supersededFindings.slice(1)}
    const prompts = scriptedPrompts({actions: ['quit']})

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(outcome).toStrictEqual({saved: [], declinedCompanions: [], ending: 'quit'})
    expect(promptMessages(prompts.selectAction)).toStrictEqual(['What do you want to do with finding #3?'])
    const info = unstyled(output.info()).replace(/[│\s]+/g, ' ')
    expect(info).toContain('No active findings to review for shopify.app.toml.')
    expect(info).toContain(
      "Reviewing 1 superseded finding that check --blocking still counts. An agent result supersedes this deterministic finding, so the review doesn't count it. But check --blocking, which reads no agent results, still counts it,",
    )
  })

  test('prompts nothing when no finding is active', async () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const prompts = scriptedPrompts({actions: []})
    const session = {...interactiveSession(), findings: [], supersededFindings: []}

    const outcome = await interactiveSecurityReview(prompts)(session)

    expect(outcome).toStrictEqual({saved: [], declinedCompanions: [], ending: 'finished'})
    expect(prompts.selectAction).not.toHaveBeenCalled()
    expect(unstyled(output.info())).toContain('No active findings to review for shopify.app.toml.')
    expect(unstyled(output.info())).not.toContain('superseded')
  })
})

describe('interactiveSecurityReview in a terminal', () => {
  /**
   * The real cli-kit prompts, drawn on a fake terminal: `type` waits until the last frame shows `text`, then types
   * `keys` on stdin.
   */
  function terminal(columns = 120) {
    const stdin = new Stdin()
    const frames: string[] = []
    const stdout = Object.assign(new EventEmitter(), {
      columns,
      rows: 40,
      write: (frame: string) => frames.push(frame) > 0,
    })
    const renderOptions = {
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WriteStream,
      debug: true,
      patchConsole: false,
    }
    const onTerminal = <TPrompt extends object>(prompt: TPrompt) => ({...prompt, renderOptions})
    const prompts: InteractiveReviewDependencies = {
      canPrompt: () => true,
      selectAction: (prompt) => renderSelectPrompt(onTerminal(prompt)),
      selectKind: (prompt) => renderSelectPrompt(onTerminal(prompt)),
      enterReason: (prompt) => renderTextPrompt(onTerminal(prompt)),
      confirmCompanions: (prompt) => renderConfirmationPrompt(onTerminal(prompt)),
    }
    const lastFrame = () => unstyled(frames.at(-1) ?? '').replace(/\s+/g, ' ')
    const type = async (text: string, ...keys: string[]) => {
      await vi.waitFor(() => expect(lastFrame()).toContain(text))
      await waitForInputsToBeReady()
      keys.forEach((key) => stdin.write(key))
    }
    return {prompts, type, frames}
  }

  test('suppresses a finding after it refuses an empty reason, then quits', async () => {
    mockAndCaptureOutput()
    const {prompts, type} = terminal()
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}])])

    const review = interactiveSecurityReview(prompts)(session)
    await type('What do you want to do with finding #2?', '\r')
    await type('Is finding #2 a false positive or an accepted risk?', '\r')
    await type('Why should finding #2 be suppressed?', '\r')
    await type('The reason must not be empty.', 'The logger redacts tokens.')
    await type('The logger redacts tokens.', '\r')
    await type('What do you want to do with finding #5?', 'q')

    await expect(review).resolves.toStrictEqual({
      saved: [{index: 0, change: 'added', entry: credentialEntry, findingNumber: 2}],
      declinedCompanions: [],
      ending: 'quit',
    })
    expect(session.suppress).toHaveBeenCalledExactlyOnceWith({
      findingNumber: 2,
      decision: {kind: 'false-positive', reason: 'The logger redacts tokens.'},
      includeSuperseded: false,
    })
  })

  test('fits each choice on one row of an 80-column terminal with a 500-character reason, so Down and Up draw the question once', async () => {
    mockAndCaptureOutput()
    const {prompts, type, frames} = terminal(80)
    const longEntry = {...credentialEntry, reason: 'The logger redacts tokens. '.repeat(19).slice(0, 500)}
    const session = interactiveSession([savedResult([{index: 0, entry: longEntry, findingNumber: 2}])], {
      reattachments: new Map([[2, {entryIndex: 0, entry: longEntry, code: 'console.log(session.accessToken)'}]]),
    })

    const review = interactiveSecurityReview(prompts)(session)
    await type('> (r) Re-attach suppressions[0] (s) Suppress', '\u001B[B')
    await type('(r) Re-attach suppressions[0] > (s) Suppress', '\u001B[A')
    await type('> (r) Re-attach suppressions[0] (s) Suppress', 'q')
    await review

    // The prompt erases one row for each line it drew, so a line wider than the terminal leaves a row behind.
    const promptFrames = frames.map((frame) => unstyled(frame)).filter((frame) => frame.includes('finding #2?'))
    const afterUp = promptFrames.findLast((frame) => frame.includes('>  (r)'))!
    const choiceRows = afterUp.split('\n').filter((row) => /\((?:r|s|c|q)\)/.test(row))
    expect(promptFrames.length).toBeGreaterThanOrEqual(3)
    expect(promptFrames.flatMap((frame) => frame.split('\n')).filter((row) => row.length > 80)).toStrictEqual([])
    expect(
      new Set(promptFrames.map((frame) => frame.split('What do you want to do with finding #2?').length)),
    ).toStrictEqual(new Set([2]))
    expect(choiceRows).toStrictEqual([
      '>  (r) Re-attach suppressions[0]',
      '   (s) Suppress',
      '   (c) Continue',
      '   (q) Quit',
    ])
  })

  test('re-attaches a stale entry with the r key, asks for no kind or reason, then quits', async () => {
    mockAndCaptureOutput()
    const {prompts, type} = terminal()
    const staleEntry = {...credentialEntry, code: 'console.log(session.idToken)'}
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}])], {
      reattachments: new Map([[2, {entryIndex: 0, entry: staleEntry, code: 'console.log(session.accessToken)'}]]),
    })

    const review = interactiveSecurityReview(prompts)(session)
    await type('> (r) Re-attach suppressions[0] (s) Suppress', 'r')
    await type('What do you want to do with finding #5?', 'q')

    await expect(review).resolves.toMatchObject({saved: [{index: 0, findingNumber: 2}], ending: 'quit'})
    expect(session.reattach).toHaveBeenCalledExactlyOnceWith(2)
    expect(session.suppress).not.toHaveBeenCalled()
  })

  test('leaves the companion when the question is answered with Enter, which is no', async () => {
    mockAndCaptureOutput()
    const {prompts, type} = terminal()
    const session = interactiveSession([savedResult([{index: 0, entry: credentialEntry, findingNumber: 2}], [1])])

    const review = interactiveSecurityReview(prompts)(session)
    await type('What do you want to do with finding #2?', 's')
    await type('Is finding #2 a false positive or an accepted risk?', '\r')
    await type('Why should finding #2 be suppressed?', 'The logger redacts tokens.')
    await type('The logger redacts tokens.', '\r')
    await type('Suppress it too, with the same kind and reason?', '\r')
    await type('What do you want to do with finding #5?', 'q')

    await expect(review).resolves.toMatchObject({declinedCompanions: [{findingNumber: 2, companionNumbers: [1]}]})
    expect(session.suppress).toHaveBeenCalledOnce()
  })

  test('suppresses a superseded finding after the active ones, and continues past the next one', async () => {
    mockAndCaptureOutput()
    const {prompts, type} = terminal()
    const session = interactiveSession([savedResult([{index: 0, entry: companionEntry, findingNumber: 1}])])

    const review = interactiveSecurityReview(prompts)(session)
    await type('What do you want to do with finding #2?', 'c')
    await type('What do you want to do with finding #5?', 'c')
    await type('What do you want to do with finding #6?', 'c')
    await type('What do you want to do with finding #1?', 's')
    await type('Is finding #1 a false positive or an accepted risk?', '\r')
    await type('Why should finding #1 be suppressed?', 'The logger redacts tokens.')
    await type('The logger redacts tokens.', '\r')
    await type('What do you want to do with finding #3?', 'c')

    await expect(review).resolves.toStrictEqual({
      saved: [{index: 0, change: 'added', entry: companionEntry, findingNumber: 1}],
      declinedCompanions: [],
      ending: 'finished',
    })
    expect(session.suppress).toHaveBeenCalledExactlyOnceWith({
      findingNumber: 1,
      decision: {kind: 'false-positive', reason: 'The logger redacts tokens.'},
      includeSuperseded: false,
    })
  })
})

describe('the interactive review outcome', () => {
  test('lists what the session saved after the summary, the companions left out, and to review and commit the file', () => {
    const output = mockAndCaptureOutput()
    output.clear()
    const input: SecurityReviewPresenterInput = {
      ...presenterInput(both),
      interactiveReview: {
        saved: [
          {index: 0, change: 'added', entry: credentialEntry, findingNumber: 2},
          {index: 1, change: 'added', entry: eolApiVersionEntry, findingNumber: 6},
        ],
        declinedCompanions: [{findingNumber: 2, companionNumbers: [1]}],
        ending: 'quit',
      },
    }

    renderSecurityReview(input)

    const alerts = buildSecurityReviewAlerts(input)
    expect(alerts.at(-2)!.options.headline).toBe('3 checks with findings. 1 check unresolved.')
    expect(alerts.at(-1)!.type).toBe('success')
    expect(alerts.at(-1)!.options.customSections!.map((section) => section.title)).toStrictEqual([
      'suppressions[0] · finding 2 · added',
      'suppressions[1] · finding 6 · added',
      'Not suppressed',
      'Next steps',
    ])
    const rendered = unstyled(output.info()).replace(/[│\s]+/g, ' ')
    expect(rendered).toContain(
      'Saved 2 suppressions to shopify.app-security.json. You quit the review. The suppressions you saved are kept.',
    )
    expect(rendered).toContain(
      'Finding 1 is a superseded deterministic finding of the same check in the same file as finding 2, so check --blocking, which reads no agent results, still counts it. To suppress it, run the review with --suppress 2 --include-superseded and the same --kind and --reason.',
    )
    expect(rendered).toContain('Next steps • Review and commit shopify.app-security.json.')
  })

  test('says when the session saved nothing, and why it stopped', () => {
    const alert = (ending: 'finished' | 'quit' | 'results-changed') =>
      buildSecurityReviewAlerts({
        ...presenterInput(both),
        interactiveReview: {saved: [], declinedCompanions: [], ending},
      }).at(-1)!

    expect(alert('finished')).toStrictEqual({
      type: 'info',
      options: {headline: 'No suppressions saved to shopify.app-security.json.'},
    })
    expect(alert('quit').options.body).toBe('You quit the review. The suppressions you saved are kept.')
    expect(alert('results-changed').options.body).toBe(
      'The review stopped because the results changed. The suppressions you saved are kept.',
    )
  })
})
