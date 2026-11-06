import securityReview, {
  numberFindings,
  reviewAppSecurityResults,
  type InteractiveReviewOutcome,
  type InteractiveReviewSession,
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
  'app/shopify.server.ts': [
    ...Array.from({length: 38}, (_, index) => `// line ${index + 1}`),
    'export function logConfiguration() {',
    '  logger.info(apiSecretKey)',
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

/** A test fixture with two sessions whose five excerpt lines are the same, as `check` redacts them, at lines 2–6 and 7–11. */
const sessionLines = [
  'export const sessions = [',
  ...[1, 2].flatMap(() => [
    '  {',
    "    shop: 'example.myshopify.com',",
    "    accessToken: 'shpa[REDACTED:38]',",
    '  },',
    '',
  ]),
  ']',
]

/**
 * The COMMITTED_SECRET findings of the sessions fixture, at lines 4 and 9, and one in another file. The two in the
 * fixture differ only by their line numbers, which the matching doesn't read, so no code can name either of them alone.
 */
const committedSecrets: Files = {
  deterministic: {
    ...deterministicFindingsDocument,
    checks: [
      {
        id: 'COMMITTED_SECRET',
        version: 1,
        status: 'executed',
        analysis_mode: 'regex',
        snapshot: {
          title: 'Committed secret or environment file',
          severity: 'high',
          description: 'Detects environment files and common API key/token patterns in source files.',
          current_version: 1,
        },
        findings: [
          ...[4, 9].map((line) =>
            withExcerpt(
              {
                location: {file: 'test/fixtures/sessions.ts', line},
                message: 'A Shopify token pattern was found in repository text.',
                evidence: [],
                snippet: sessionLines[line - 1],
              },
              sessionLines,
            ),
          ),
          withExcerpt(
            {
              location: {file: 'test/fixtures/shop.ts', line: 1},
              message: 'A Shopify token pattern was found in repository text.',
              evidence: [],
            },
            ["export const accessToken = 'shpa[REDACTED:38]'"],
          ),
        ],
      },
    ],
  },
}

/** The advice for finding 1 or 2 of `committedSecrets`: the entry without code that suppresses both, or a code change. */
function committedSecretsAdvice(findingNumber: number): string {
  return `No code from its lines, evidence or message names it alone. A deterministic entry for COMMITTED_SECRET in test/fixtures/sessions.ts without code suppresses all 2 deterministic findings of that check in that file: 1 and 2. To suppress them all, add such an entry to shopify.app-security.json by hand. To suppress only finding ${findingNumber}, change the code so that the findings differ, and run check again.`
}

/**
 * The document with only the check `checkId`, renamed to `renamedId`, a check ID that this CLI doesn't know, as in results
 * that another version of the CLI wrote.
 */
function withRenamedCheck<TDocument extends FindingsDocument>(
  document: TDocument,
  checkId: string,
  renamedId: string,
): TDocument {
  return {
    ...document,
    checks: document.checks.filter(({id}) => id === checkId).map((check) => ({...check, id: renamedId})),
  }
}

/** A COMMITTED_SECRET finding in a file whose name has a `*`, which no entry of shopify.app-security.json can name. */
const wildcardPathSecret: Files = {
  deterministic: {
    ...committedSecrets.deterministic!,
    checks: committedSecrets.deterministic!.checks.map((check) => ({
      ...check,
      findings: [
        withExcerpt(
          {
            location: {file: 'app/routes/*.tsx', line: 1},
            message: 'A Shopify token pattern was found in repository text.',
            evidence: [],
          },
          ["export const accessToken = 'shpa[REDACTED:38]'"],
        ),
      ],
    })),
  },
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

  test('saves an entry for a superseded deterministic finding by its number, which check --blocking counts', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const resultsDigest = await digestOf(appRoot)

      // Finding 3 is superseded by the prefer-agent result for CREDENTIAL_LOG_LEAKAGE, which has no finding in its file.
      const reviewed = await suppress(appRoot, {
        findingNumber: 3,
        kind: 'false-positive',
        reason: 'The logger drops secrets.',
        resultsDigest,
      })

      const entry = {
        source: 'deterministic',
        check: 'CREDENTIAL_LOG_LEAKAGE',
        kind: 'false-positive',
        path: 'app/shopify.server.ts',
        code: 'logger.info(apiSecretKey)',
        reason: 'The logger drops secrets.',
        configurations: ['shopify.app.toml'],
      }
      expect(reviewed.savedSuppressions).toStrictEqual({
        path: appSecuritySuppressionsPath(appRoot),
        saved: [{index: 0, change: 'added', entry, findingNumber: 3}],
        companionNumbers: [],
      })
      await expect(readEntries(appRoot)).resolves.toStrictEqual([entry])
      // It stays superseded in the review, but its entry matched it, so check --blocking leaves it out.
      const numbered = numberFindings(reviewed.result.allChecks)
      expect(numbered.find(({number}) => number === 3)?.finding).toMatchObject({
        source: 'deterministic',
        disposition: 'superseded',
        suppressed_by: {origin: 'file', entry_index: 0, kind: 'false-positive', reason: 'The logger drops secrets.'},
      })
      expect(numbered.find(({number}) => number === 1)?.finding.suppressed_by).toBeUndefined()
      expect(reviewed.result.suppressions).toMatchObject([{status: 'matched', matched_finding_count: 1}])
      expect(reviewed.result.resultsDigest).toBe(resultsDigest)
    })
  })

  test('refuses a superseded finding that an entry already suppresses, also with --include-superseded', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      await suppress(appRoot, {findingNumber: 3})
      // The agent finding 2, then its companion, finding 1.
      await suppress(appRoot, {findingNumber: 2, includeSuperseded: true})
      const entries = await readEntries(appRoot)

      const refusals = await Promise.all(
        [
          {findingNumber: 3, includeSuperseded: false},
          {findingNumber: 3, includeSuperseded: true},
          {findingNumber: 1, includeSuperseded: false},
        ].map((flags) => captureError(() => suppress(appRoot, flags))),
      )

      expect(
        refusals.map(({code, message, tryMessage, details}) => ({code, message, tryMessage, details})),
      ).toStrictEqual(
        [
          [3, 0],
          [3, 0],
          [1, 2],
        ].map(([findingNumber, entryIndex]) => ({
          code: 'finding-not-suppressible',
          message: `Finding ${findingNumber} is already suppressed by suppressions[${entryIndex}] in shopify.app-security.json. Nothing was saved.`,
          tryMessage: 'To change the suppression, edit shopify.app-security.json.',
          details: {findingNumber, disposition: 'superseded'},
        })),
      )
      await expect(readEntries(appRoot)).resolves.toStrictEqual(entries)
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
    ['an empty reason', {reason: ''}, ['--reason: must not be empty']],
    ['an unknown kind', {kind: 'wont-fix'}, ['--kind: must be false-positive or accepted-risk']],
    [
      'an unknown kind without a reason',
      {kind: 'wont-fix', reason: undefined},
      ['--kind: must be false-positive or accepted-risk'],
    ],
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
    ['a missing reason', 6, {reason: undefined}, ['--reason: required']],
    ['a missing kind', 6, {kind: undefined}, ['--kind: required (false-positive or accepted-risk)']],
    [
      'both flags missing',
      6,
      {kind: undefined, reason: undefined},
      ['--kind: required (false-positive or accepted-risk)', '--reason: required'],
    ],
    [
      'both flags missing, for a number that no finding has',
      7,
      {kind: undefined, reason: undefined},
      ['--kind: required (false-positive or accepted-risk)', '--reason: required'],
    ],
  ])(
    'refuses %s with the same error as before, once the results show that no stale entry likely names the finding',
    async (_name, findingNumber, flags, errors) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory, bothWithExcerpts)

        const error = await captureError(() => suppress(appRoot, {findingNumber, ...flags}))

        expect(error.message).toBe('The suppression could not be saved because a flag is invalid.')
        expect(error.tryMessage).toBe(
          'Pass --kind false-positive or --kind accepted-risk, and a --reason that explains the decision.',
        )
        expect(error.code).toBe('suppression-flags-invalid')
        expect(error.details).toStrictEqual({errors})
        expect(error.customSections).toStrictEqual([{title: 'Errors', body: {list: {items: errors}}}])
        await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
      })
    },
  )

  test.each([
    [
      'a number that no finding has',
      7,
      'finding-not-found',
      'No finding has number 7. Nothing was saved.',
      'The findings are numbered from 1 to 6. Run the review to see their numbers.',
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

  test('refuses a finding that no code can name alone, and advises the entry without code that suppresses all the findings in its file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, committedSecrets)

      const error = await captureError(() => suppress(appRoot, {findingNumber: 2}))

      expect(error).toMatchObject({
        code: 'finding-not-suppressible',
        message:
          "Finding 2 can't be suppressed: every code from its lines also names another finding of COMMITTED_SECRET in test/fixtures/sessions.ts. Nothing was saved.",
        tryMessage: committedSecretsAdvice(2),
        details: {findingNumber: 2},
      })
      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
    })
  })

  test('keeps the advice of a code by hand when its message names the finding alone, although the plan finds no code', async () => {
    await inTemporaryDirectory(async (directory) => {
      const lines = ['export async function loader() {', '  console.log(session.accessToken)', '  return null', '}']
      const [credentialCheck] = agentFindingsDocument.checks
      const finding = (message: string) =>
        withExcerpt(
          {
            location: {file: 'app/routes/orders.tsx', line: 2},
            message,
            evidence: [{location: {file: 'app/routes/orders.tsx', line: 2}}],
          },
          lines,
        )
      // The same line, but each agent finding has its own message, so an entry with that message as its code names it alone.
      const appRoot = await createApp(directory, {
        agent: {
          ...agentFindingsDocument,
          checks: [
            {
              ...credentialCheck!,
              findings: [
                finding('The loader writes the access token to the log.'),
                finding('The token reaches a log.'),
              ],
            },
          ],
        },
      })

      const error = await captureError(() => suppress(appRoot, {findingNumber: 1}))

      expect(error).toMatchObject({
        code: 'finding-not-suppressible',
        message:
          "Finding 1 can't be suppressed: every code from its lines also names another finding of CREDENTIAL_LOG_LEAKAGE in app/routes/orders.tsx. Nothing was saved.",
        tryMessage: 'Add an entry for it to shopify.app-security.json by hand, with a code that names it alone.',
      })
      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
    })
  })

  test.each([
    {
      source: 'deterministic',
      files: {deterministic: withRenamedCheck(bothWithExcerpts.deterministic!, 'EOL_API_VERSION', 'API_VERSION_EOL')},
      checkId: 'API_VERSION_EOL',
      path: 'shopify.app.toml',
      update: 'run check again',
    },
    {
      source: 'agent',
      files: {agent: withRenamedCheck(bothWithExcerpts.agent!, 'CREDENTIAL_LOG_LEAKAGE', 'CREDENTIAL_LOGGING')},
      checkId: 'CREDENTIAL_LOGGING',
      path: 'app/routes/orders.tsx',
      update: 'have your coding agent run check and record its findings again',
    },
  ])(
    'refuses a $source finding of a check that this CLI does not know, and advises new results, not an entry by hand',
    async ({source, files, checkId, path, update}) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory, files)

        const error = await captureError(() => suppress(appRoot, {findingNumber: 1}))

        expect(error).toMatchObject({
          code: 'finding-not-suppressible',
          message:
            "Finding 1 can't be suppressed: its entry would be invalid: check: not a known check ID. Nothing was saved.",
          tryMessage: `This version of the CLI has no ${source} check ${checkId}, so an entry for it by hand would make shopify.app-security.json invalid too. The results are from another version of the CLI. To update them, ${update}.`,
          details: {findingNumber: 1},
        })
        await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
        // An entry for the finding, added by hand, makes the file invalid, so review can't run.
        await writeFile(
          appSecuritySuppressionsPath(appRoot),
          JSON.stringify({
            schema_version: 1,
            suppressions: [
              {
                source,
                check: checkId,
                kind: 'accepted-risk',
                path,
                reason: 'The results are old.',
                configurations: ['shopify.app.toml'],
              },
            ],
          }),
        )
        await expect(
          securityReview({directory: appRoot, checkIds: [], blocking: 'none'}, testDependencies()),
        ).rejects.toMatchObject({
          code: 'suppressions-file-invalid',
          details: {errors: ['suppressions[0].check: not a known check ID']},
        })
      })
    },
  )

  test('refuses a finding whose path no entry can name, and says so instead of advising an entry by hand', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, wildcardPathSecret)

      const error = await captureError(() => suppress(appRoot, {findingNumber: 1}))

      expect(error).toMatchObject({
        code: 'finding-not-suppressible',
        message:
          "Finding 1 can't be suppressed: its entry would be invalid: path: can't contain wildcards: name one file. Nothing was saved.",
        tryMessage:
          "shopify.app-security.json can't name the path app/routes/*.tsx, so no entry can suppress this finding. An entry for it by hand would make the file invalid too.",
        details: {findingNumber: 1},
      })
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

/**
 * deterministic-findings.json after a scan of app/routes/session.ts, whose line 2 assigns a Shopify token to `name`, with
 * the line redacted as `check` captures it. Finding 1 is that token. The app has no other COMMITTED_SECRET finding.
 */
function committedTokenResults(name: string): Files {
  const lines = ['// Session fixtures.', `export const ${name} = "shpa[REDACTED:38]"`, 'export const shop = "example"']
  return {
    deterministic: {
      ...deterministicFindingsDocument,
      checks: [
        {
          ...committedSecrets.deterministic!.checks[0]!,
          findings: [
            withExcerpt(
              {
                location: {file: 'app/routes/session.ts', line: 2},
                message: 'A Shopify token pattern was found in repository text.',
                evidence: [],
              },
              lines,
            ),
          ],
        },
      ],
    },
  }
}

/** A deterministic CREDENTIAL_LOG_LEAKAGE finding in `app/routes/session.ts`, whose line 2 logs `<name>.accessToken`. */
function loggedTokenResults(name: string): Files {
  const lines = ['export function logSession(session) {', `  console.log(${name}.accessToken)`, '}']
  return {
    deterministic: {
      ...deterministicFindingsDocument,
      checks: [
        {
          ...deterministicFindingsDocument.checks.find(({id}) => id === 'CREDENTIAL_LOG_LEAKAGE')!,
          findings: [
            withExcerpt(
              {
                location: {file: 'app/routes/session.ts', line: 2},
                message: 'accessToken flows into console.log.',
                evidence: [],
              },
              lines,
            ),
          ],
        },
      ],
    },
  }
}

/** Writes the results of `files` again, as a new `check` or `record` does. */
async function writeResults(appRoot: string, files: Files): Promise<void> {
  const paths = appSecurityArtifactPaths(appRoot, RESULTS_KEY)
  if (files.deterministic) await writeFile(paths.deterministicFindingsPath, JSON.stringify(files.deterministic))
  if (files.agent) await writeFile(paths.agentFindingsPath, JSON.stringify(files.agent))
}

/** An app with the source file that the results above name, so an entry for it isn't for a file that is gone. */
async function createSessionApp(directory: string, files: Files): Promise<string> {
  const appRoot = await createApp(directory, files)
  await mkdir(joinPath(appRoot, 'app', 'routes'))
  await writeFile(joinPath(appRoot, 'app', 'routes', 'session.ts'), 'export const shop = "example"\n')
  return appRoot
}

describe('securityReview --suppress, for the likely finding of a stale entry', () => {
  function suppress(appRoot: string, flags: Partial<SecurityReviewSuppressOptions> & {findingNumber: number}) {
    return securityReview(
      {
        directory: appRoot,
        checkIds: [],
        blocking: 'high',
        suppress: {kind: undefined, reason: undefined, resultsDigest: undefined, includeSuperseded: false, ...flags},
      },
      testDependencies(),
    )
  }

  async function reviewOf(appRoot: string) {
    return securityReview({directory: appRoot, checkIds: [], blocking: 'high'}, testDependencies())
  }

  async function readFileEntries(appRoot: string): Promise<unknown> {
    return (JSON.parse(await readFile(appSecuritySuppressionsPath(appRoot))) as {suppressions: unknown}).suppressions
  }

  const reason = 'Only logged in local development.'

  test('reproduction: after a rename on the flagged line, re-attaches the entry without --kind and --reason, so nothing is stale', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createSessionApp(directory, loggedTokenResults('session'))
      await suppress(appRoot, {findingNumber: 1, kind: 'false-positive', reason})
      await writeResults(appRoot, loggedTokenResults('currentSession'))

      const stale = await reviewOf(appRoot)
      const reattached = await suppress(appRoot, {findingNumber: 1, resultsDigest: stale.result.resultsDigest!})

      expect(stale.result.suppressions).toMatchObject([
        {status: 'stale', likely_finding: {index: 0, file: 'app/routes/session.ts', line: 2}},
      ])
      expect([...stale.result.likelyFindingNumbers]).toStrictEqual([[0, 1]])
      expect(stale.result.blocking.blockedChecks).toBe(1)
      const entry = {
        source: 'deterministic',
        check: 'CREDENTIAL_LOG_LEAKAGE',
        kind: 'false-positive',
        path: 'app/routes/session.ts',
        code: 'console.log(currentSession.accessToken)',
        reason,
        configurations: ['shopify.app.toml'],
      }
      expect(reattached.savedSuppressions).toStrictEqual({
        path: appSecuritySuppressionsPath(appRoot),
        saved: [
          {
            index: 0,
            change: 'code-replaced',
            entry,
            previous: {code: 'console.log(session.accessToken)', kind: 'false-positive', reason},
            findingNumber: 1,
          },
        ],
        companionNumbers: [],
      })
      await expect(readFileEntries(appRoot)).resolves.toStrictEqual([entry])
      expect(dispositionsOf(reattached.result.checks, 'CREDENTIAL_LOG_LEAKAGE')).toEqual([
        {source: 'deterministic', disposition: 'suppressed'},
      ])
      expect(reattached.result.checks[0]!.findings[0]!.suppressed_by).toMatchObject({entry_index: 0, reason})
      expect(reattached.result.suppressions.map(({status}) => status)).toEqual(['matched'])
      expect(reattached.result.likelyFindingNumbers.size).toBe(0)
      expect(reattached.result.blocking.blockedChecks).toBe(0)
    })
  })

  test('replaces the kind and the reason with --kind and --reason, and still updates the entry in place', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createSessionApp(directory, loggedTokenResults('session'))
      await suppress(appRoot, {findingNumber: 1, kind: 'false-positive', reason})
      await writeResults(appRoot, loggedTokenResults('currentSession'))

      const onlyKind = await suppress(appRoot, {findingNumber: 1, kind: 'accepted-risk'})
      await writeResults(appRoot, loggedTokenResults('offlineSession'))
      const onlyReason = await suppress(appRoot, {findingNumber: 1, reason: 'Rotated every week.'})

      expect(onlyKind.savedSuppressions?.saved).toMatchObject([
        {index: 0, change: 'code-replaced', entry: {kind: 'accepted-risk', reason}},
      ])
      expect(onlyReason.savedSuppressions?.saved).toMatchObject([
        {
          index: 0,
          change: 'code-replaced',
          entry: {
            kind: 'accepted-risk',
            code: 'console.log(offlineSession.accessToken)',
            reason: 'Rotated every week.',
          },
          previous: {code: 'console.log(currentSession.accessToken)', kind: 'accepted-risk', reason},
        },
      ])
      await expect(readFileEntries(appRoot)).resolves.toMatchObject([
        {kind: 'accepted-risk', code: 'console.log(offlineSession.accessToken)', reason: 'Rotated every week.'},
      ])
    })
  })

  test('names no likely finding after a rename on a line with a redacted secret, so --suppress needs --kind and --reason, and appends an entry as before', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createSessionApp(directory, committedTokenResults('KEY'))
      const tokenReason = 'A fake token in the session fixtures.'
      await suppress(appRoot, {findingNumber: 1, kind: 'false-positive', reason: tokenReason})
      await writeResults(appRoot, committedTokenResults('KEY2'))
      const fileText = await readFile(appSecuritySuppressionsPath(appRoot))

      const stale = await reviewOf(appRoot)
      const error = await captureError(() => suppress(appRoot, {findingNumber: 1}))
      const suppressed = await suppress(appRoot, {findingNumber: 1, kind: 'false-positive', reason: tokenReason})

      expect(stale.result.suppressions).toMatchObject([{status: 'stale'}])
      expect(stale.result.suppressions[0]).not.toHaveProperty('likely_finding')
      expect(stale.result.likelyFindingNumbers.size).toBe(0)
      expect(error).toMatchObject({
        code: 'suppression-flags-invalid',
        message: 'The suppression could not be saved because a flag is invalid.',
        details: {errors: ['--kind: required (false-positive or accepted-risk)', '--reason: required']},
      })
      expect(suppressed.savedSuppressions?.saved).toMatchObject([
        {index: 1, change: 'added', entry: {code: 'export const KEY2 = "shpa[REDACTED:38]"', reason: tokenReason}},
      ])
      expect(fileText).toContain('export const KEY = ')
      expect(suppressed.result.suppressions.map(({status}) => status)).toEqual(['stale', 'matched'])
    })
  })

  test('re-attaches an agent entry, and suppresses the companions with its kind and reason with --include-superseded', async () => {
    await inTemporaryDirectory(async (directory) => {
      // Finding 2, the agent CREDENTIAL_LOG_LEAKAGE finding, logs `session.accessToken`. Finding 1 is its companion.
      const appRoot = await createApp(directory, bothWithExcerpts)
      const agentEntry = {
        source: 'agent',
        check: 'CREDENTIAL_LOG_LEAKAGE',
        kind: 'accepted-risk',
        path: 'app/routes/orders.tsx',
        code: 'console.log(session.idToken)',
        reason: 'The logger redacts tokens.',
        configurations: ['shopify.app.toml'],
      }
      await writeFile(
        appSecuritySuppressionsPath(appRoot),
        JSON.stringify({schema_version: 1, suppressions: [agentEntry]}),
      )
      await mkdir(joinPath(appRoot, 'app', 'routes'))
      await writeFile(joinPath(appRoot, 'app', 'routes', 'orders.tsx'), 'export {}\n')

      const reattached = await suppress(appRoot, {findingNumber: 2, includeSuperseded: true})

      expect(reattached.savedSuppressions?.saved).toStrictEqual([
        {
          index: 0,
          change: 'code-replaced',
          entry: {...agentEntry, code: 'console.log(session.accessToken)'},
          previous: {code: 'console.log(session.idToken)', kind: 'accepted-risk', reason: 'The logger redacts tokens.'},
          findingNumber: 2,
        },
        {
          index: 1,
          change: 'added',
          entry: {...agentEntry, source: 'deterministic', code: 'console.log(session.accessToken)'},
          findingNumber: 1,
        },
      ])
      expect(reattached.result.suppressions.map(({status}) => status)).toEqual(['matched', 'matched'])
    })
  })

  test('refuses a likely finding that no code names alone, as for a new entry, and leaves the stale entry as it is', async () => {
    await inTemporaryDirectory(async (directory) => {
      const renamedLine = '  console.log(currentSession.accessToken)'
      // Finding 2 logs an order, but its evidence is the renamed line, so every code of finding 1 names finding 2 too.
      const agent: AgentFindingsDocument = {
        ...agentFindingsDocument,
        checks: [
          {
            ...agentFindingsDocument.checks.find(({id}) => id === 'CREDENTIAL_LOG_LEAKAGE')!,
            snapshot: {...agentFindingsDocument.checks[0]!.snapshot, precedence: 'union'},
            findings: [
              {
                location: {file: 'app/routes/orders.tsx', line: 12},
                message: 'The session token reaches a log.',
                evidence: [],
                code_excerpt: [{line: 12, text: renamedLine}],
              },
              {
                location: {file: 'app/routes/orders.tsx', line: 20},
                message: 'An order reaches a log.',
                evidence: [
                  {location: {file: 'app/routes/orders.tsx', line: 12}, code_excerpt: [{line: 12, text: renamedLine}]},
                ],
                code_excerpt: [{line: 20, text: '  logger.info(order)'}],
              },
            ],
          },
        ],
      }
      const appRoot = await createApp(directory, {agent})
      const agentEntry = {
        source: 'agent',
        check: 'CREDENTIAL_LOG_LEAKAGE',
        kind: 'accepted-risk',
        path: 'app/routes/orders.tsx',
        code: 'console.log(session.accessToken)',
        reason: 'The logger redacts tokens.',
        configurations: ['shopify.app.toml'],
      }
      const fileText = JSON.stringify({schema_version: 1, suppressions: [agentEntry]})
      await writeFile(appSecuritySuppressionsPath(appRoot), fileText)
      await mkdir(joinPath(appRoot, 'app', 'routes'))
      await writeFile(joinPath(appRoot, 'app', 'routes', 'orders.tsx'), 'export {}\n')

      const stale = await reviewOf(appRoot)
      const error = await captureError(() => suppress(appRoot, {findingNumber: 1}))

      expect([...stale.result.likelyFindingNumbers]).toStrictEqual([[0, 1]])
      expect(error).toMatchObject({
        code: 'finding-not-suppressible',
        message:
          "Finding 1 can't be suppressed: every code from its lines also names another finding of CREDENTIAL_LOG_LEAKAGE in app/routes/orders.tsx. Nothing was saved.",
        tryMessage: 'Add an entry for it to shopify.app-security.json by hand, with a code that names it alone.',
      })
      await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.toBe(fileText)
    })
  })
})

describe('securityReview --interactive', () => {
  const decision = {kind: 'false-positive', reason: 'The logger redacts tokens.'} as const

  /** Runs `review --interactive` with `run` as the session, which returns what the session saved. */
  function reviewInteractively(
    appRoot: string,
    run: (session: InteractiveReviewSession) => Promise<InteractiveReviewOutcome>,
    checkIds: string[] = [],
  ) {
    return securityReview({directory: appRoot, checkIds, blocking: 'high', interactive: run}, testDependencies())
  }

  function outcomeOf(saved: InteractiveReviewOutcome['saved'] = []): InteractiveReviewOutcome {
    return {saved, declinedCompanions: [], ending: 'finished'}
  }

  async function readEntries(appRoot: string): Promise<unknown> {
    return (JSON.parse(await readFile(appSecuritySuppressionsPath(appRoot))) as {suppressions: unknown}).suppressions
  }

  /** Records the active and the superseded findings that each session offers, as `<number> <check> <source>`. */
  function offeredFindings() {
    const offered: {active: string[]; superseded: string[]}[] = []
    const label = ({number, check, finding}: InteractiveReviewSession['findings'][number]) =>
      `${number} ${check.id} ${finding.source}`
    const record = async (session: InteractiveReviewSession) => {
      offered.push({active: session.findings.map(label), superseded: session.supersededFindings.map(label)})
      return outcomeOf()
    }
    return {offered, record}
  }

  test('offers the active findings of the checks that --check-id selects, most severe first', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const {offered, record} = offeredFindings()
      const checkSession = async (session: InteractiveReviewSession) => {
        expect(session.configuration).toBe('shopify.app.toml')
        expect(session.result.resultsDigest).toMatch(/^[0-9a-f]{12}$/)
        return record(session)
      }

      await reviewInteractively(appRoot, checkSession)
      await reviewInteractively(appRoot, checkSession, ['EOL_API_VERSION', 'CREDENTIAL_LOG_LEAKAGE'])
      await reviewInteractively(appRoot, checkSession, ['EOL_API_VERSION'])

      // Finding 4 is suppressed by the agent, and 1 and 3 are superseded deterministic findings.
      expect(offered).toStrictEqual([
        {
          active: [
            '2 CREDENTIAL_LOG_LEAKAGE agent',
            '5 MISSING_TENANT_ISOLATION agent',
            '6 EOL_API_VERSION deterministic',
          ],
          superseded: ['1 CREDENTIAL_LOG_LEAKAGE deterministic', '3 CREDENTIAL_LOG_LEAKAGE deterministic'],
        },
        {
          active: ['2 CREDENTIAL_LOG_LEAKAGE agent', '6 EOL_API_VERSION deterministic'],
          superseded: ['1 CREDENTIAL_LOG_LEAKAGE deterministic', '3 CREDENTIAL_LOG_LEAKAGE deterministic'],
        },
        {active: ['6 EOL_API_VERSION deterministic'], superseded: []},
      ])
    })
  })

  test('offers only the superseded findings that no entry suppresses, which check --blocking still counts', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const {offered, record} = offeredFindings()

      await reviewInteractively(appRoot, async (session) => {
        await expect(session.suppress({findingNumber: 3, decision, includeSuperseded: false})).resolves.toMatchObject({
          status: 'saved',
          savedSuppressions: {saved: [{index: 0, change: 'added', findingNumber: 3}], companionNumbers: []},
        })
        return outcomeOf()
      })
      await reviewInteractively(appRoot, record)

      expect(offered[0]?.superseded).toStrictEqual(['1 CREDENTIAL_LOG_LEAKAGE deterministic'])
      await expect(readEntries(appRoot)).resolves.toMatchObject([
        {source: 'deterministic', check: 'CREDENTIAL_LOG_LEAKAGE', path: 'app/shopify.server.ts'},
      ])
    })
  })

  test('saves with the planner and writer of --suppress, then returns the review after the session', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const entry = {
        source: 'deterministic',
        check: 'EOL_API_VERSION',
        kind: 'false-positive',
        path: 'shopify.app.toml',
        code: 'api_version = "2024-01"',
        reason: 'The logger redacts tokens.',
        configurations: ['shopify.app.toml'],
      }
      let outcome: InteractiveReviewOutcome | undefined

      const reviewed = await reviewInteractively(appRoot, async (session) => {
        const saved = await session.suppress({findingNumber: 6, decision, includeSuperseded: false})
        expect(saved).toStrictEqual({
          status: 'saved',
          savedSuppressions: {
            path: appSecuritySuppressionsPath(appRoot),
            saved: [{index: 0, change: 'added', entry, findingNumber: 6}],
            companionNumbers: [],
          },
        })
        outcome = outcomeOf(saved.status === 'saved' ? saved.savedSuppressions.saved : [])
        return outcome
      })

      expect(reviewed.interactiveReview).toBe(outcome)
      expect(reviewed.savedSuppressions).toBeUndefined()
      await expect(readEntries(appRoot)).resolves.toStrictEqual([entry])
      expect(dispositionsOf(reviewed.result.checks, 'EOL_API_VERSION')).toEqual([
        {source: 'deterministic', disposition: 'suppressed'},
      ])
      expect(reviewed.result.suppressions.map(({status}) => status)).toEqual(['matched'])
    })
  })

  test('reads the results again for each save, so the companions of a saved agent finding are saved alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)

      await reviewInteractively(appRoot, async (session) => {
        const agentEntry = await session.suppress({findingNumber: 2, decision, includeSuperseded: false})
        const companions = await session.suppress({findingNumber: 2, decision, includeSuperseded: true})

        expect(agentEntry).toMatchObject({status: 'saved', savedSuppressions: {companionNumbers: [1]}})
        expect(companions).toMatchObject({
          status: 'saved',
          savedSuppressions: {saved: [{index: 1, change: 'added', findingNumber: 1}], companionNumbers: []},
        })
        return outcomeOf()
      })

      await expect(readEntries(appRoot)).resolves.toMatchObject([
        {source: 'agent', check: 'CREDENTIAL_LOG_LEAKAGE', kind: 'false-positive'},
        {source: 'deterministic', check: 'CREDENTIAL_LOG_LEAKAGE', kind: 'false-positive'},
      ])
    })
  })

  test('returns the refusals of --suppress without aborting, and saves nothing for them', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)

      await reviewInteractively(appRoot, async (session) => {
        await expect(session.suppress({findingNumber: 5, decision, includeSuperseded: false})).resolves.toStrictEqual({
          status: 'refused',
          refusal: {
            code: 'finding-not-suppressible',
            message:
              "Finding 5 can't be suppressed: the results hold no code for its line, so no entry can name it alone. Nothing was saved.",
            tryMessage: 'Add an entry for it to shopify.app-security.json by hand, with a code that names it alone.',
            details: {findingNumber: 5},
          },
        })
        await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
        await expect(session.suppress({findingNumber: 6, decision, includeSuperseded: false})).resolves.toMatchObject({
          status: 'saved',
        })
        return outcomeOf()
      })

      await expect(readEntries(appRoot)).resolves.toMatchObject([{check: 'EOL_API_VERSION'}])
    })
  })

  test('returns the advice of an entry without code for a finding that no code can name alone', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, committedSecrets)

      await reviewInteractively(appRoot, async (session) => {
        await expect(session.suppress({findingNumber: 1, decision, includeSuperseded: false})).resolves.toMatchObject({
          status: 'refused',
          refusal: {code: 'finding-not-suppressible', tryMessage: committedSecretsAdvice(1)},
        })
        return outcomeOf()
      })

      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
    })
  })

  test('returns advice without an entry by hand for a finding whose entry would be invalid', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {
        deterministic: withRenamedCheck(bothWithExcerpts.deterministic!, 'EOL_API_VERSION', 'API_VERSION_EOL'),
      })

      await reviewInteractively(appRoot, async (session) => {
        await expect(session.suppress({findingNumber: 1, decision, includeSuperseded: false})).resolves.toMatchObject({
          status: 'refused',
          refusal: {
            code: 'finding-not-suppressible',
            tryMessage:
              'This version of the CLI has no deterministic check API_VERSION_EOL, so an entry for it by hand would make shopify.app-security.json invalid too. The results are from another version of the CLI. To update them, run check again.',
          },
        })
        return outcomeOf()
      })

      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
    })
  })

  test('returns the same refusal when the reason would make the entry invalid, without an entry by hand', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)

      // The session asks for a reason that the file accepts, but `suppress` itself plans with the reason it gets.
      await reviewInteractively(appRoot, async (session) => {
        await expect(
          session.suppress({findingNumber: 6, decision: {...decision, reason: ' '}, includeSuperseded: false}),
        ).resolves.toStrictEqual({
          status: 'refused',
          refusal: {
            code: 'finding-not-suppressible',
            message:
              "Finding 6 can't be suppressed: its entry would be invalid: reason: must not be empty. Nothing was saved.",
            tryMessage:
              'An entry for it by hand with the same values would make shopify.app-security.json invalid too.',
            details: {findingNumber: 6},
          },
        })
        return outcomeOf()
      })

      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
    })
  })

  test('refuses a number once the results changed during the session, and reviews the new results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)
      const [first, ...rest] = bothWithExcerpts.deterministic!.checks
      const [finding, ...otherFindings] = first!.findings
      const rescanned = {
        ...bothWithExcerpts.deterministic!,
        checks: [{...first!, findings: [{...finding!, message: 'Another issue.'}, ...otherFindings]}, ...rest],
      }
      let startDigest: string | null = null

      const reviewed = await reviewInteractively(appRoot, async (session) => {
        startDigest = session.result.resultsDigest
        await writeFile(
          appSecurityArtifactPaths(appRoot, RESULTS_KEY).deterministicFindingsPath,
          JSON.stringify(rescanned),
        )

        await expect(session.suppress({findingNumber: 6, decision, includeSuperseded: false})).resolves.toMatchObject({
          status: 'refused',
          refusal: {code: 'results-digest-mismatch', details: {resultsDigest: expect.not.stringMatching(startDigest!)}},
        })
        return {...outcomeOf(), ending: 'results-changed'}
      })

      await expect(fileExists(appSecuritySuppressionsPath(appRoot))).resolves.toBe(false)
      expect(reviewed.result.resultsDigest).not.toBe(startDigest)
    })
  })
})

describe('securityReview --interactive, for the likely finding of a stale entry', () => {
  const reason = 'Only logged in local development.'
  const staleEntry = {
    source: 'deterministic',
    check: 'CREDENTIAL_LOG_LEAKAGE',
    kind: 'false-positive',
    path: 'app/routes/session.ts',
    code: 'console.log(session.accessToken)',
    reason,
    configurations: ['shopify.app.toml'],
  } as const

  async function createRenamedApp(
    directory: string,
    {files = loggedTokenResults('currentSession'), entry = staleEntry}: {files?: Files; entry?: object} = {},
  ): Promise<string> {
    const appRoot = await createSessionApp(directory, files)
    await writeFile(appSecuritySuppressionsPath(appRoot), JSON.stringify({schema_version: 1, suppressions: [entry]}))
    return appRoot
  }

  /** The re-attach offers of `review --interactive` on the app. */
  async function offersOf(appRoot: string) {
    let offers: InteractiveReviewSession['reattachments'] | undefined
    await securityReview(
      {
        directory: appRoot,
        checkIds: [],
        blocking: 'high',
        interactive: async (session) => {
          offers = session.reattachments
          return {saved: [], declinedCompanions: [], ending: 'finished'}
        },
      },
      testDependencies(),
    )
    return [...(offers ?? [])]
  }

  test('offers to re-attach the stale entry with the code it would get, and re-attaches it with its kind and reason', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createRenamedApp(directory)
      let offers: InteractiveReviewSession['reattachments'] | undefined

      const reviewed = await securityReview(
        {
          directory: appRoot,
          checkIds: [],
          blocking: 'high',
          interactive: async (session) => {
            offers = session.reattachments
            const result = await session.reattach(1)
            if (result.status !== 'saved') throw new Error('The re-attach was refused.')
            return {saved: result.savedSuppressions.saved, declinedCompanions: [], ending: 'finished'}
          },
        },
        testDependencies(),
      )

      expect([...(offers ?? [])]).toStrictEqual([
        [1, {entryIndex: 0, entry: staleEntry, code: 'console.log(currentSession.accessToken)'}],
      ])
      expect(reviewed.interactiveReview?.saved).toMatchObject([
        {index: 0, change: 'code-replaced', entry: {kind: 'false-positive', reason}, findingNumber: 1},
      ])
      expect(reviewed.result.suppressions.map(({status}) => status)).toEqual(['matched'])
    })
  })

  test('refuses to re-attach a finding that is no longer the likely finding of a stale entry, and saves nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createRenamedApp(directory)
      const fileText = await readFile(appSecuritySuppressionsPath(appRoot))

      await securityReview(
        {
          directory: appRoot,
          checkIds: [],
          blocking: 'high',
          interactive: async (session) => {
            // The file changes during the session: the entry is gone.
            await writeFile(appSecuritySuppressionsPath(appRoot), JSON.stringify({schema_version: 1, suppressions: []}))
            const result = await session.reattach(1)
            await writeFile(appSecuritySuppressionsPath(appRoot), fileText)
            expect(result).toStrictEqual({
              status: 'refused',
              refusal: {
                code: 'finding-not-suppressible',
                message: 'Finding 1 is no longer the likely finding of a stale entry. Nothing was saved.',
                tryMessage:
                  'Choose Suppress to save a new entry for it, or run the review again to see the stale entries of shopify.app-security.json.',
                details: {findingNumber: 1},
              },
            })
            return {saved: [], declinedCompanions: [], ending: 'finished'}
          },
        },
        testDependencies(),
      )

      await expect(readFile(appSecuritySuppressionsPath(appRoot))).resolves.toBe(fileText)
    })
  })

  test('offers no re-attach after a rename on a line with a redacted secret', async () => {
    await inTemporaryDirectory(async (directory) => {
      const secretEntry = {...staleEntry, check: 'COMMITTED_SECRET', code: 'export const KEY = "shpa[REDACTED:38]"'}
      const appRoot = await createRenamedApp(directory, {files: committedTokenResults('KEY2'), entry: secretEntry})

      await expect(offersOf(appRoot)).resolves.toStrictEqual([])
    })
  })

  test('offers no re-attach without a stale entry that likely names a finding', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, bothWithExcerpts)

      await expect(offersOf(appRoot)).resolves.toStrictEqual([])
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
      await writeFile(
        appSecuritySuppressionsPath(appRoot),
        JSON.stringify({schema_version: 1, suppressions: [eolApiVersionEntry, tenantIsolationEntry]}),
      )
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
