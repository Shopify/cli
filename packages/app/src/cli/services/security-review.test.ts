import {writeAppSecuritySuppressionsFixture} from './app-security-suppressions.test-data.js'
import securityReview, {
  numberFindings,
  reviewAppSecurityResults,
  type SecurityReviewDependencies,
  type SecurityReviewSuppressOptions,
} from './security-review.js'
import {appSecurityArtifactPaths, appSecuritySuppressionsPath} from './app-security-artifacts.js'
import {resolveAppSecuritySelection, type AppSecuritySelectionOptions} from './app-security-selection.js'
import {validAppConfiguration} from './app-security-selection.test-data.js'
import {loadAppSecurityResults} from './app-security-results.js'
import {appSecurityResultsFor} from './app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppSecurityBlockingLevel} from './app-security-api.js'
import type {
  AgentFindingsDocument,
  CombinedCheck,
  DeterministicFindingsDocument,
  FindingsDocument,
  StoredFinding,
  SuppressionEntry,
} from './app-security-engine/index.js'

// The results key of `createApp`'s shopify.app.toml.
const RESULTS_KEY = 'shopify.app'

interface Files {
  deterministic?: DeterministicFindingsDocument
  agent?: AgentFindingsDocument
}

async function createApp(directory: string, files: Files): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const paths = appSecurityArtifactPaths(directory, RESULTS_KEY)
  await mkdir(paths.resultsDirectory)
  if (files.deterministic) await writeFile(paths.deterministicFindingsPath, JSON.stringify(files.deterministic))
  if (files.agent) await writeFile(paths.agentFindingsPath, JSON.stringify(files.agent))
  return directory
}

function testDependencies() {
  const dependencies = {
    resolveSelection: async ({path}) =>
      ({
        kind: 'config',
        appDirectory: path,
        appConfigFilePath: joinPath(path, 'shopify.app.toml'),
      }) as const,
    loadResults: loadAppSecurityResults,
    recordMetadata: vi.fn(async () => {}),
  } satisfies SecurityReviewDependencies
  return dependencies
}

function review(
  files: Files,
  options: {checkIds?: string[]; blocking?: AppSecurityBlockingLevel; suppressions?: SuppressionEntry[]} = {},
) {
  const results = appSecurityResultsFor(
    '/tmp/review-app',
    RESULTS_KEY,
    {deterministic: files.deterministic ?? null, agent: files.agent ?? null},
    options.suppressions,
  )
  return reviewAppSecurityResults(results, {
    resultsDirectory: appSecurityArtifactPaths('/tmp/review-app', RESULTS_KEY).resultsDirectory,
    checkIds: options.checkIds ?? [],
    blocking: options.blocking ?? 'none',
  })
}

const both: Files = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}

/** Entries for findings of the shared fixtures: the deterministic EOL_API_VERSION one, and an agent one that its message names. */
const eolApiVersionEntry: SuppressionEntry = {
  source: 'deterministic',
  check: 'EOL_API_VERSION',
  kind: 'accepted-risk',
  path: 'shopify.app.toml',
  reason: 'The upgrade ships with the next release.',
  configurations: ['shopify.app.toml'],
}
const tenantIsolationEntry: SuppressionEntry = {
  source: 'agent',
  check: 'MISSING_TENANT_ISOLATION',
  kind: 'false-positive',
  path: 'app/routes/orders.tsx',
  code: 'the query has no shop filter',
  reason: 'Every order table holds one shop.',
  configurations: ['shopify.app.toml'],
}

function dispositionsOf(checks: CombinedCheck[], id: string) {
  return checks.find((check) => check.id === id)?.findings.map(({source, disposition}) => ({source, disposition}))
}

/** Runs `action`, which is expected to abort, and returns the AbortError it threw. */
async function captureError(action: () => unknown): Promise<AbortError> {
  const error: unknown = await Promise.resolve()
    .then(action)
    .catch((error: unknown) => error)
  expect(error).toBeInstanceOf(AbortError)
  return error as AbortError
}

describe('reviewAppSecurityResults', () => {
  describe('scope', () => {
    const otherScope = {include_dirs: ['../backend'], excludes: [], no_git_ignore: false}

    test('differs when the agent reported another scope than the latest scan used', () => {
      const differing = {
        deterministic: deterministicFindingsDocument,
        agent: {...agentFindingsDocument, scope: otherScope},
      }

      expect(review(differing).scopeDiffers).toBe(true)
    })

    test('does not differ when the scopes match, or when either result is missing', () => {
      expect(review(both).scopeDiffers).toBe(false)
      expect(review({deterministic: deterministicFindingsDocument}).scopeDiffers).toBe(false)
      expect(review({agent: {...agentFindingsDocument, scope: otherScope}}).scopeDiffers).toBe(false)
      expect(review({}).scopeDiffers).toBe(false)
    })

    test('does not change the blocking outcome', () => {
      const differing = {
        deterministic: deterministicFindingsDocument,
        agent: {...agentFindingsDocument, scope: otherScope},
      }

      expect(review(differing, {blocking: 'high'}).blocking).toEqual(review(both, {blocking: 'high'}).blocking)
    })
  })

  describe('--check-id', () => {
    test('keeps every combined check in canonical order without a filter', () => {
      const result = review(both)

      expect(result.filter).toBeNull()
      expect(result.checks).toBe(result.allChecks)
      expect(result.checks.map((check) => check.id)).toEqual([
        'CREDENTIAL_LOG_LEAKAGE',
        'MISSING_TENANT_ISOLATION',
        'UNAUTHENTICATED_ENDPOINT',
        'UNSAFE_INNERHTML',
        'OPEN_REDIRECT',
        'EOL_API_VERSION',
      ])
    })

    test('narrows the checks to the exact IDs, keeping canonical order', () => {
      const result = review(both, {checkIds: ['EOL_API_VERSION', 'CREDENTIAL_LOG_LEAKAGE']})

      expect(result.filter).toEqual({checkIds: ['EOL_API_VERSION', 'CREDENTIAL_LOG_LEAKAGE']})
      expect(result.checks.map((check) => check.id)).toEqual(['CREDENTIAL_LOG_LEAKAGE', 'EOL_API_VERSION'])
      expect(result.allChecks).toHaveLength(6)
    })

    test('matches IDs exactly, not by prefix or case', () => {
      expect(() => review(both, {checkIds: ['credential_log_leakage']})).toThrow(AbortError)
      expect(() => review(both, {checkIds: ['OPEN_REDIRECT', 'EOL']})).toThrow(AbortError)
    })

    test('rejects an ID that matches no check in either file and lists the available IDs', async () => {
      const abort = await captureError(() =>
        review({agent: agentFindingsDocument}, {checkIds: ['OPEN_REDIRECT', 'NOT_A_CHECK']}),
      )

      expect(abort.message).toBe('Unknown check ID: NOT_A_CHECK.')
      expect(abort.code).toBe('unknown-check-id')
      expect(abort.details).toStrictEqual({checkIds: ['NOT_A_CHECK']})
      expect(abort.customSections).toEqual([
        {
          title: 'Available check IDs',
          body: {
            list: {
              items: [
                'CREDENTIAL_LOG_LEAKAGE',
                'MISSING_TENANT_ISOLATION',
                'UNAUTHENTICATED_ENDPOINT',
                'OPEN_REDIRECT',
              ],
            },
          },
        },
      ])
    })

    test('pluralizes the error for several unknown IDs, and lists only those in its details', async () => {
      const abort = await captureError(() => review(both, {checkIds: ['A', 'OPEN_REDIRECT', 'B']}))

      expect(abort.message).toBe('Unknown check IDs: A, B.')
      expect(abort.details).toStrictEqual({checkIds: ['A', 'B']})
    })

    test('skips the unknown-ID check when no file is present, echoing the filter with no checks', () => {
      const result = review({}, {checkIds: ['NOT_A_CHECK']})

      expect(result.filter).toEqual({checkIds: ['NOT_A_CHECK']})
      expect(result.checks).toEqual([])
    })
  })

  describe('suppressions', () => {
    test("returns each entry's result in file order, whatever --check-id selects", () => {
      const result = review(both, {
        checkIds: ['OPEN_REDIRECT'],
        suppressions: [tenantIsolationEntry, eolApiVersionEntry, {...eolApiVersionEntry, path: 'shopify.app.dev.toml'}],
      })

      expect(
        result.suppressions.map(({index, status, matched_finding_count: count}) => ({index, status, count})),
      ).toEqual([
        {index: 0, status: 'matched', count: 1},
        {index: 1, status: 'matched', count: 1},
        {index: 2, status: 'stale', count: 0},
      ])
    })

    test('has no results without entries', () => {
      expect(review(both).suppressions).toEqual([])
    })
  })

  describe('--blocking', () => {
    test('never breaches at none', () => {
      expect(review(both, {blocking: 'none'}).blocking).toEqual({level: 'none', blockedChecks: 0})
    })

    test('counts the filtered checks with an active finding at or above the level', () => {
      // Active: CREDENTIAL_LOG_LEAKAGE (high), MISSING_TENANT_ISOLATION (high), EOL_API_VERSION (low).
      expect(review(both, {blocking: 'high'}).blocking).toEqual({level: 'high', blockedChecks: 2})
      expect(review(both, {blocking: 'medium'}).blocking).toEqual({level: 'medium', blockedChecks: 2})
      expect(review(both, {blocking: 'low'}).blocking).toEqual({level: 'low', blockedChecks: 3})
      expect(review(both, {blocking: 'high', checkIds: ['EOL_API_VERSION']}).blocking).toEqual({
        level: 'high',
        blockedChecks: 0,
      })
    })

    test('ignores unresolved checks and checks whose findings are all suppressed or superseded', () => {
      // UNAUTHENTICATED_ENDPOINT is high and unresolved; UNSAFE_INNERHTML is high and not applicable.
      const result = review(both, {blocking: 'high', checkIds: ['UNAUTHENTICATED_ENDPOINT', 'UNSAFE_INNERHTML']})
      expect(result.blocking.blockedChecks).toBe(0)

      // CREDENTIAL_LOG_LEAKAGE's deterministic findings are superseded once the agent records none.
      const agent: AgentFindingsDocument = {
        ...agentFindingsDocument,
        checks: agentFindingsDocument.checks.map((check) =>
          check.id === 'CREDENTIAL_LOG_LEAKAGE' ? {...check, findings: []} : check,
        ),
      }
      const superseded = review({deterministic: deterministicFindingsDocument, agent}, {blocking: 'high'})
      expect(superseded.blocking.blockedChecks).toBe(1)
    })

    test('ignores findings that an entry of shopify.app-security.json suppresses, from either source', () => {
      const suppressions = [eolApiVersionEntry, tenantIsolationEntry]

      // Active without the entries: CREDENTIAL_LOG_LEAKAGE and MISSING_TENANT_ISOLATION (high), EOL_API_VERSION (low).
      expect(review(both, {blocking: 'high', suppressions}).blocking).toEqual({level: 'high', blockedChecks: 1})
      expect(review(both, {blocking: 'low', suppressions}).blocking).toEqual({level: 'low', blockedChecks: 1})
      const {checks} = review(both, {suppressions})
      expect(dispositionsOf(checks, 'EOL_API_VERSION')).toEqual([{source: 'deterministic', disposition: 'suppressed'}])
      expect(dispositionsOf(checks, 'MISSING_TENANT_ISOLATION')).toEqual([
        {source: 'agent', disposition: 'suppressed'},
        {source: 'agent', disposition: 'suppressed'},
      ])
    })

    test('blocks on the deterministic findings of a prefer-agent check when the agent result is stale', () => {
      // The agent recorded CREDENTIAL_LOG_LEAKAGE clean before the deterministic scan found two high findings.
      const staleAgent: AgentFindingsDocument = {
        ...agentFindingsDocument,
        generated_at: '2026-09-01T09:00:00.000Z',
        checks: agentFindingsDocument.checks.map((check) =>
          check.id === 'CREDENTIAL_LOG_LEAKAGE' ? {...check, findings: []} : check,
        ),
      }
      const files: Files = {deterministic: deterministicFindingsDocument, agent: staleAgent}

      const result = review(files, {blocking: 'high', checkIds: ['CREDENTIAL_LOG_LEAKAGE']})

      expect(result.checks[0]!.applied_precedence).toBe('union')
      expect(result.blocking.blockedChecks).toBe(1)
      // With the agent result current, the same documents pass: the deterministic findings are superseded.
      const currentAgent = {...staleAgent, generated_at: deterministicFindingsDocument.generated_at}
      expect(
        review({...files, agent: currentAgent}, {blocking: 'high', checkIds: ['CREDENTIAL_LOG_LEAKAGE']}).blocking
          .blockedChecks,
      ).toBe(0)
    })
  })
})

describe('finding numbers and the results digest', () => {
  test('number every finding of every check, in the order review lists them, whatever --check-id selects', () => {
    const all = review(both)
    const filtered = review(both, {checkIds: ['EOL_API_VERSION', 'MISSING_TENANT_ISOLATION']})

    const numbered = (result: ReturnType<typeof review>) =>
      result.checks.flatMap((check) =>
        check.findings.map((finding) => `${result.findingNumbers.get(finding)} ${check.id} ${finding.source}`),
      )
    expect(numbered(all)).toStrictEqual([
      '1 CREDENTIAL_LOG_LEAKAGE deterministic',
      '2 CREDENTIAL_LOG_LEAKAGE agent',
      '3 CREDENTIAL_LOG_LEAKAGE deterministic',
      '4 MISSING_TENANT_ISOLATION agent',
      '5 MISSING_TENANT_ISOLATION agent',
      '6 EOL_API_VERSION deterministic',
    ])
    expect(numbered(filtered)).toStrictEqual([
      '4 MISSING_TENANT_ISOLATION agent',
      '5 MISSING_TENANT_ISOLATION agent',
      '6 EOL_API_VERSION deterministic',
    ])
    expect(numberFindings(all.allChecks).map(({number}) => number)).toStrictEqual([1, 2, 3, 4, 5, 6])
  })

  test('keep the digest when only --check-id, the suppressions or the times change', () => {
    const {resultsDigest} = review(both)

    expect(resultsDigest).toMatch(/^[0-9a-f]{12}$/)
    expect(review(both, {checkIds: ['EOL_API_VERSION']}).resultsDigest).toBe(resultsDigest)
    expect(review(both, {suppressions: [eolApiVersionEntry, tenantIsolationEntry]}).resultsDigest).toBe(resultsDigest)
    const later = {...agentFindingsDocument, generated_at: '2026-09-02T09:00:00.000Z'}
    expect(review({...both, agent: later}).resultsDigest).toBe(resultsDigest)
  })

  test('change the digest when a number could name another finding, and have none without results files', () => {
    const {resultsDigest} = review(both)
    const [first, ...rest] = deterministicFindingsDocument.checks
    const [finding, ...otherFindings] = first!.findings
    const withFinding = (changed: StoredFinding): DeterministicFindingsDocument => ({
      ...deterministicFindingsDocument,
      checks: [{...first!, findings: [changed, ...otherFindings]}, ...rest],
    })
    // The order of the stored findings doesn't count: review sorts them.
    const reordered = {
      ...deterministicFindingsDocument,
      checks: [{...first!, findings: [...first!.findings].reverse()}, ...rest],
    }

    expect(review({...both, deterministic: reordered}).resultsDigest).toBe(resultsDigest)
    expect(
      review({...both, deterministic: withFinding({...finding!, message: 'Another issue.'})}).resultsDigest,
    ).not.toBe(resultsDigest)
    expect(
      review({...both, deterministic: withFinding({...finding!, location: {...finding!.location, line: 13}})})
        .resultsDigest,
    ).not.toBe(resultsDigest)
    expect(review({deterministic: deterministicFindingsDocument}).resultsDigest).not.toBe(resultsDigest)
    expect(review({}).resultsDigest).toBeNull()
  })
})

/** The finding with the lines around `line` of `lines` as its excerpt, as `check` and `record` capture them. */
function withExcerpt(finding: StoredFinding, lines: string[]): StoredFinding {
  const line = finding.location.line!
  return {
    ...finding,
    code_excerpt: lines
      .map((text, index) => ({line: index + 1, text}))
      .filter((excerptLine) => Math.abs(excerptLine.line - line) <= 2),
  }
}

/** The lines of each file that the shared fixtures cite, at the lines they cite. */
const sourceLines: Record<string, string[]> = {
  'app/routes/orders.tsx': [
    ...Array.from({length: 10}, (_, index) => `// line ${index + 1}`),
    'export async function loader() {',
    '  console.log(session.accessToken)',
    '  return null',
    '}',
  ],
  'shopify.app.toml': [...Array.from({length: 7}, (_, index) => `# line ${index + 1}`), 'api_version = "2024-01"'],
}

/** The document with excerpts on the findings in the files of `sourceLines`, as a current CLI writes them. */
function withExcerpts<TDocument extends FindingsDocument>(document: TDocument): TDocument {
  return {
    ...document,
    checks: document.checks.map((check) => ({
      ...check,
      findings: check.findings.map((finding) => {
        const lines = sourceLines[finding.location.file]
        return lines ? withExcerpt(finding, lines) : finding
      }),
    })),
  }
}

const bothWithExcerpts: Files = {
  deterministic: withExcerpts(deterministicFindingsDocument),
  agent: withExcerpts(agentFindingsDocument),
}

describe('securityReview --suppress', () => {
  /** Runs `review --suppress` on the app with these flags; the kind and reason default to valid ones. */
  function suppress(appRoot: string, flags: Partial<SecurityReviewSuppressOptions> & {findingNumber: number}) {
    return securityReview(
      {
        directory: appRoot,
        checkIds: [],
        blocking: 'none',
        suppress: {
          kind: 'accepted-risk',
          reason: 'The upgrade ships with the next release.',
          resultsDigest: undefined,
          includeSuperseded: false,
          ...flags,
        },
      },
      testDependencies(),
    )
  }

  async function digestOf(appRoot: string): Promise<string> {
    const reviewed = await securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, testDependencies())
    return reviewed.result.resultsDigest!
  }

  async function readEntries(appRoot: string): Promise<unknown> {
    return (JSON.parse(await readFile(appSecuritySuppressionsPath(appRoot))) as {suppressions: unknown}).suppressions
  }

  test('saves an entry that suppresses only the numbered finding, and returns the review after the save', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const resultsDigest = await digestOf(appRoot)

      const reviewed = await suppress(appRoot, {findingNumber: 6, resultsDigest})

      const entry = {
        source: 'deterministic',
        check: 'EOL_API_VERSION',
        kind: 'accepted-risk',
        path: 'shopify.app.toml',
        code: 'api_version = "2024-01"',
        reason: 'The upgrade ships with the next release.',
        configurations: ['shopify.app.toml'],
      }
      expect(reviewed.savedSuppressions).toStrictEqual({
        path: appSecuritySuppressionsPath(appRoot),
        saved: [{index: 0, change: 'added', entry, findingNumber: 6}],
        companionNumbers: [],
      })
      await expect(readEntries(appRoot)).resolves.toStrictEqual([entry])
      expect(dispositionsOf(reviewed.result.checks, 'EOL_API_VERSION')).toEqual([
        {source: 'deterministic', disposition: 'suppressed'},
      ])
      // The numbers and the digest stay, because the results files didn't change.
      expect(reviewed.result.resultsDigest).toBe(resultsDigest)
      expect(reviewed.result.suppressions.map(({status}) => status)).toEqual(['matched'])
    })
  })

  test("names the agent finding's superseded companion without --include-superseded, and suppresses it with it", async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const otherApp = joinPath(directory, 'other')
      await mkdir(otherApp)
      await createApp(otherApp, bothWithExcerpts)

      const alone = await suppress(appRoot, {findingNumber: 2, kind: 'false-positive', reason: 'Redacted.'})
      const withCompanion = await suppress(otherApp, {
        findingNumber: 2,
        kind: 'false-positive',
        reason: 'Redacted.',
        includeSuperseded: true,
      })

      // Finding 3, the other deterministic finding, is in another file, so it isn't a companion.
      expect(alone.savedSuppressions?.companionNumbers).toStrictEqual([1])
      expect(alone.savedSuppressions?.saved.map(({entry, findingNumber}) => [findingNumber, entry.source])).toEqual([
        [2, 'agent'],
      ])
      expect(withCompanion.savedSuppressions?.companionNumbers).toStrictEqual([])
      expect(
        withCompanion.savedSuppressions?.saved.map(({entry, findingNumber}) => [findingNumber, entry.source]),
      ).toEqual([
        [2, 'agent'],
        [1, 'deterministic'],
      ])
      await expect(readEntries(otherApp)).resolves.toMatchObject([
        {
          source: 'agent',
          check: 'CREDENTIAL_LOG_LEAKAGE',
          code: 'console.log(session.accessToken)',
          kind: 'false-positive',
        },
        {
          source: 'deterministic',
          check: 'CREDENTIAL_LOG_LEAKAGE',
          code: 'console.log(session.accessToken)',
          kind: 'false-positive',
        },
      ])
      // The companion stays superseded in review, but its entry matched it, so check --blocking leaves it out.
      expect(dispositionsOf(withCompanion.result.checks, 'CREDENTIAL_LOG_LEAKAGE')).toEqual([
        {source: 'deterministic', disposition: 'superseded'},
        {source: 'agent', disposition: 'suppressed'},
        {source: 'deterministic', disposition: 'superseded'},
      ])
      expect(withCompanion.result.suppressions.map(({status}) => status)).toEqual(['matched', 'matched'])
    })
  })

  test("names the companions on the agent finding's line, or every one in its file when none is on that line", async () => {
    await inTemporaryDirectory(async (directory) => {
      const [credentialCheck, ...otherChecks] = bothWithExcerpts.deterministic!.checks
      const [orders, ...otherFindings] = credentialCheck!.findings
      // A second superseded deterministic finding in the same file, on the next line.
      const nextLine = withExcerpt(
        {...orders!, location: {...orders!.location, line: 13}},
        sourceLines['app/routes/orders.tsx']!,
      )
      const deterministic = {
        ...bothWithExcerpts.deterministic!,
        checks: [{...credentialCheck!, findings: [orders!, nextLine, ...otherFindings]}, ...otherChecks],
      }
      const [agentCheck, ...otherAgentChecks] = bothWithExcerpts.agent!.checks
      const movedAgent = {
        ...bothWithExcerpts.agent!,
        checks: [
          {
            ...agentCheck!,
            findings: agentCheck!.findings.map((finding) =>
              withExcerpt(
                {...finding, location: {...finding.location, line: 14}},
                sourceLines['app/routes/orders.tsx']!,
              ),
            ),
          },
          ...otherAgentChecks,
        ],
      }
      await mkdir(joinPath(directory, 'same-line'))
      await mkdir(joinPath(directory, 'other-line'))
      const sameLineApp = await createApp(joinPath(directory, 'same-line'), {
        deterministic,
        agent: bothWithExcerpts.agent!,
      })
      const otherLineApp = await createApp(joinPath(directory, 'other-line'), {deterministic, agent: movedAgent})

      // Numbers: 1 deterministic line 12, 2 agent line 12, 3 deterministic line 13, 4 in another file.
      const sameLine = await suppress(sameLineApp, {findingNumber: 2})
      // Numbers: 1 deterministic line 12, 2 deterministic line 13, 3 agent line 14, 4 in another file.
      const otherLine = await suppress(otherLineApp, {findingNumber: 3})

      expect(sameLine.savedSuppressions?.companionNumbers).toStrictEqual([1])
      expect(otherLine.savedSuppressions?.companionNumbers).toStrictEqual([1, 2])
    })
  })

  test('with --include-superseded on a finding that an entry already suppresses, saves only its companion', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      await suppress(appRoot, {findingNumber: 2})

      const again = await suppress(appRoot, {findingNumber: 2, includeSuperseded: true})

      expect(again.savedSuppressions?.saved.map(({index, findingNumber}) => [index, findingNumber])).toEqual([[1, 1]])
      await expect(suppress(appRoot, {findingNumber: 2, includeSuperseded: true})).rejects.toMatchObject({
        code: 'finding-not-suppressible',
        message: expect.stringContaining('Finding 2 is already suppressed by suppressions[0]'),
      })
    })
  })

  test('adds the configuration to the entry of another configuration that names the same finding', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const stagingEntry = {
        source: 'deterministic',
        check: 'EOL_API_VERSION',
        kind: 'accepted-risk',
        path: 'shopify.app.toml',
        code: 'api_version = "2024-01"',
        reason: 'Staging follows production.',
        configurations: ['shopify.app.staging.toml'],
      }
      await writeFile(
        appSecuritySuppressionsPath(appRoot),
        JSON.stringify({schema_version: 1, suppressions: [stagingEntry]}, null, 2),
      )

      const reviewed = await suppress(appRoot, {findingNumber: 6})

      const entry = {...stagingEntry, configurations: ['shopify.app.staging.toml', 'shopify.app.toml']}
      expect(reviewed.savedSuppressions?.saved).toStrictEqual([
        {index: 0, change: 'configuration-added', entry, findingNumber: 6},
      ])
      await expect(readEntries(appRoot)).resolves.toStrictEqual([entry])
    })
  })

  test('refuses a stale digest, and saves nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const resultsDigest = await digestOf(appRoot)

      await expect(suppress(appRoot, {findingNumber: 6, resultsDigest: '000000000000'})).rejects.toMatchObject({
        code: 'results-digest-mismatch',
        message:
          'The results changed since digest 000000000000, so the finding numbers may name other findings. Nothing was saved.',
        details: {resultsDigest},
      })
      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
    })
  })

  test.each([
    ['a missing reason', {reason: undefined}, ['--reason: required']],
    ['an empty reason', {reason: ''}, ['--reason: must not be empty']],
    ['an unknown kind', {kind: 'wont-fix'}, ['--kind: must be false-positive or accepted-risk']],
    ['a missing kind', {kind: undefined}, ['--kind: required (false-positive or accepted-risk)']],
  ])('refuses %s before it reads anything', async (_name, flags, errors) => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const dependencies = {...testDependencies(), loadResults: vi.fn(loadAppSecurityResults)}

      const error = await captureError(() =>
        securityReview(
          {
            directory: appRoot,
            checkIds: [],
            blocking: 'none',
            suppress: {
              findingNumber: 6,
              kind: 'accepted-risk',
              reason: 'r',
              resultsDigest: undefined,
              includeSuperseded: false,
              ...flags,
            },
          },
          dependencies,
        ),
      )

      expect(error.message).toBe('The suppression could not be saved because a flag is invalid.')
      expect(error.code).toBe('suppression-flags-invalid')
      expect(error.details).toStrictEqual({errors})
      expect(error.customSections).toStrictEqual([{title: 'Errors', body: {list: {items: errors}}}])
      expect(dependencies.loadResults).not.toHaveBeenCalled()
    })
  })

  test.each([
    [
      'a number that no finding has',
      7,
      'finding-not-found',
      'No finding has number 7. Nothing was saved.',
      'The findings are numbered from 1 to 6. Run the review to see their numbers.',
    ],
    [
      'a superseded finding',
      1,
      'finding-not-suppressible',
      'Finding 1 is superseded: the agent result for CREDENTIAL_LOG_LEAKAGE replaces the deterministic findings. Nothing was saved.',
      'To suppress it for check --blocking, which reads no agent results, suppress the agent finding in the same file with --include-superseded.',
    ],
    [
      'a finding that the agent suppressed',
      4,
      'finding-not-suppressible',
      'Finding 4 is already suppressed by the agent. Nothing was saved.',
      'To change the suppression, edit shopify.app-security.json.',
    ],
    [
      'a finding whose line the results hold no code for',
      5,
      'finding-not-suppressible',
      "Finding 5 can't be suppressed: the results hold no code for its line, so no entry can name it alone. Nothing was saved.",
      'Add an entry for it to shopify.app-security.json by hand, with a code that names it alone.',
    ],
  ])('refuses %s with a clear message, and saves nothing', async (_name, findingNumber, code, message, tryMessage) => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)

      const error = await captureError(() => suppress(appRoot, {findingNumber}))

      expect(error).toMatchObject({code, message, tryMessage})
      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
    })
  })

  test('refuses every number when there are no results files', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {})

      await expect(suppress(appRoot, {findingNumber: 1})).rejects.toMatchObject({
        code: 'finding-not-found',
        tryMessage: 'The results have no findings.',
      })
    })
  })
})

describe('securityReview', () => {
  test('records the number of active findings across every check, whatever --check-id selects', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      const unfiltered = testDependencies()
      const filtered = testDependencies()

      await securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, unfiltered)
      await securityReview({directory: appRoot, checkIds: ['OPEN_REDIRECT'], blocking: 'none'}, filtered)

      // Six recorded findings: two deterministic ones superseded by a prefer-agent check and one suppressed by the agent.
      // OPEN_REDIRECT has none, so the filtered run would record zero if it counted only the selected checks.
      expect(unfiltered.recordMetadata).toHaveBeenCalledWith({num_security_findings: 3})
      expect(filtered.recordMetadata).toHaveBeenCalledWith({num_security_findings: 3})
    })
  })

  test('records nothing when there are no result files', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {})
      const dependencies = testDependencies()

      await securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, dependencies)

      expect(dependencies.recordMetadata).not.toHaveBeenCalled()
    })
  })

  test('returns the selection, the reviewed results and the commands to run next', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)

      const review = await securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, testDependencies())

      expect(review.selection).toStrictEqual({
        kind: 'config',
        appDirectory: appRoot,
        appConfigFilePath: joinPath(appRoot, 'shopify.app.toml'),
      })
      expect(review.commands.scan.args).toContainEqual({flag: '--path', value: relativePath(cwd(), appRoot)})
      expect(review.result.resultsDirectory).toBe(appSecurityArtifactPaths(appRoot, RESULTS_KEY).resultsDirectory)
      expect(review.result.sources.deterministic?.path).toBe(
        appSecurityArtifactPaths(appRoot, RESULTS_KEY).deterministicFindingsPath,
      )
      expect(review.result.checks).toHaveLength(6)
      expect(review.result.blocking).toEqual({level: 'none', blockedChecks: 0})
    })
  })

  test('repeats the latest scan scope in the check command', async () => {
    await inTemporaryDirectory(async (directory) => {
      const scope = {include_dirs: ['../backend'], excludes: ['vendor/**'], no_git_ignore: true}
      const deterministic = {
        ...deterministicFindingsDocument,
        coverage: {...deterministicFindingsDocument.coverage, scope},
      }
      const appRoot = await createApp(directory, {deterministic})

      const review = await securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, testDependencies())

      expect(review.commands.scan.args.slice(-3)).toEqual([
        {flag: '--include-dir', value: '../backend'},
        {flag: '--exclude', value: 'vendor/**'},
        '--no-git-ignore',
      ])
    })
  })

  test('returns the blocked checks when --blocking is breached', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)

      const review = await securityReview({directory: appRoot, checkIds: [], blocking: 'high'}, testDependencies())

      expect(review.result.blocking).toEqual({level: 'high', blockedChecks: 2})
    })
  })

  test('blocks no check with missing files, even with --check-id and --blocking', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {})

      const review = await securityReview(
        {directory: appRoot, checkIds: ['NOT_A_CHECK'], blocking: 'high'},
        testDependencies(),
      )

      expect(review.result.blocking).toEqual({level: 'high', blockedChecks: 0})
      expect(review.result.sources).toEqual({deterministic: null, agent: null})
      expect(review.result.checks).toEqual([])
      expect(review.result.filter).toEqual({checkIds: ['NOT_A_CHECK']})
    })
  })

  test('aborts on an unknown --check-id', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)

      await expect(
        securityReview({directory: appRoot, checkIds: ['NOT_A_CHECK'], blocking: 'none'}, testDependencies()),
      ).rejects.toThrow('Unknown check ID: NOT_A_CHECK.')
    })
  })

  test('lets the loader abort on an invalid file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {deterministic: deterministicFindingsDocument})
      await writeFile(appSecurityArtifactPaths(appRoot, RESULTS_KEY).agentFindingsPath, '{not json')

      await expect(
        securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, testDependencies()),
      ).rejects.toThrow('The app security check results could not be loaded because a results file is invalid.')
    })
  })

  test('applies the entries of shopify.app-security.json, so a suppressed finding no longer fails --blocking', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      const blocked = await securityReview({directory: appRoot, checkIds: [], blocking: 'high'}, testDependencies())
      await writeAppSecuritySuppressionsFixture(appRoot, [eolApiVersionEntry, tenantIsolationEntry])
      const dependencies = testDependencies()

      const review = await securityReview({directory: appRoot, checkIds: [], blocking: 'high'}, dependencies)

      expect(blocked.result.blocking).toEqual({level: 'high', blockedChecks: 2})
      expect(review.result.blocking).toEqual({level: 'high', blockedChecks: 1})
      expect(dispositionsOf(review.result.checks, 'EOL_API_VERSION')).toEqual([
        {source: 'deterministic', disposition: 'suppressed'},
      ])
      expect(review.result.suppressions.map(({status}) => status)).toEqual(['matched', 'matched'])
      // Only CREDENTIAL_LOG_LEAKAGE's agent finding stays active.
      expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 1})
    })
  })

  test('aborts on an invalid shopify.app-security.json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      await writeFile(
        appSecuritySuppressionsPath(appRoot),
        JSON.stringify({schema_version: 1, suppressions: [{...eolApiVersionEntry, kind: undefined}]}),
      )

      await expect(
        securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, testDependencies()),
      ).rejects.toMatchObject({
        code: 'suppressions-file-invalid',
        details: {errors: ['suppressions[0].kind: required (false-positive or accepted-risk)']},
      })
    })
  })

  test('aborts with "No results found" when the results directory does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await fileRealPath(directory)

      await expect(
        securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, testDependencies()),
      ).rejects.toMatchObject({message: `No app security check results for ${RESULTS_KEY} in ${appRoot}.`})
    })
  })
})

describe('securityReview --client-id lookup', () => {
  const unknownClientId = new AbortError('No app with client ID unknown-client-id found')
  const reviewOptions = {checkIds: [], blocking: 'none' as const}

  /** The real selection resolver, with the client ID lookup replaced, and a spy on the results loader. */
  function lookUpDependencies(lookUpApp: (clientId: string) => Promise<void>) {
    return {
      ...testDependencies(),
      // Review never prompts, so the selection is never declined.
      resolveSelection: (options: AppSecuritySelectionOptions & {allowPrompts: false}) =>
        resolveAppSecuritySelection(options, {
          confirmScanWithoutAppConfig: async () => true,
          pickClientId: async () => 'picked-client-id',
          pickConfigFile: async () => 'shopify.app.toml',
          lookUpApp,
        }),
      loadResults: vi.fn(loadAppSecurityResults),
    }
  }

  /** An app that the real resolver loads, with an empty results directory for `resultsKey`. */
  async function createLinkedApp(directory: string, resultsKey: string): Promise<string> {
    const appRoot = await fileRealPath(directory)
    await writeFile(joinPath(appRoot, 'shopify.app.toml'), validAppConfiguration('toml-client-id'))
    await mkdir(appSecurityArtifactPaths(appRoot, resultsKey).resultsDirectory)
    return appRoot
  }

  test('looks up --client-id and reads its results when it is found', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createLinkedApp(directory, 'flag-client-id')
      const lookUpApp = vi.fn(async (_clientId: string) => {})
      const dependencies = lookUpDependencies(lookUpApp)

      await securityReview({...reviewOptions, directory: appRoot, clientId: 'flag-client-id'}, dependencies)

      expect(lookUpApp).toHaveBeenCalledWith('flag-client-id')
      expect(dependencies.loadResults).toHaveBeenCalledWith(
        expect.objectContaining({clientIdOverride: 'flag-client-id'}),
        appRoot,
      )
    })
  })

  test('aborts on an unknown --client-id before reading any results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createLinkedApp(directory, 'unknown-client-id')
      const dependencies = lookUpDependencies(async () => {
        throw unknownClientId
      })

      await expect(
        securityReview({...reviewOptions, directory: appRoot, clientId: 'unknown-client-id'}, dependencies),
      ).rejects.toBe(unknownClientId)

      expect(dependencies.loadResults).not.toHaveBeenCalled()
      expect(dependencies.recordMetadata).not.toHaveBeenCalled()
    })
  })

  test('does not look up the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createLinkedApp(directory, RESULTS_KEY)
      const lookUpApp = vi.fn(async (_clientId: string) => {})

      await securityReview({...reviewOptions, directory: appRoot}, lookUpDependencies(lookUpApp))

      expect(lookUpApp).not.toHaveBeenCalled()
    })
  })
})
