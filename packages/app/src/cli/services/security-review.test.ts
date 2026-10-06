import securityReview, {reviewAppSecurityResults, type SecurityReviewDependencies} from './security-review.js'
import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {resolveAppSecuritySelection, type AppSecuritySelectionOptions} from './app-security-selection.js'
import {validAppConfiguration} from './app-security-selection.test-data.js'
import {loadAppSecurityResults} from './app-security-results.js'
import {appSecurityResultsFor} from './app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppSecurityBlockingLevel} from './app-security-api.js'
import type {AgentFindingsDocument, DeterministicFindingsDocument} from './app-security-engine/index.js'

const now = new Date('2026-09-01T12:30:00.000Z')

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
    output: vi.fn(),
    render: vi.fn(),
    now: () => now,
    setExitCode: vi.fn(),
    recordMetadata: vi.fn(async () => {}),
  } satisfies SecurityReviewDependencies
  return dependencies
}

function review(files: Files, options: {checkIds?: string[]; blocking?: AppSecurityBlockingLevel} = {}) {
  const results = appSecurityResultsFor('/tmp/review-app', RESULTS_KEY, {
    deterministic: files.deterministic ?? null,
    agent: files.agent ?? null,
  })
  return reviewAppSecurityResults(results, {
    resultsDirectory: appSecurityArtifactPaths('/tmp/review-app', RESULTS_KEY).resultsDirectory,
    checkIds: options.checkIds ?? [],
    blocking: options.blocking ?? 'none',
  })
}

const both: Files = {deterministic: deterministicFindingsDocument, agent: agentFindingsDocument}

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

    test('pluralizes the error for several unknown IDs', () => {
      expect(() => review(both, {checkIds: ['A', 'B']})).toThrow('Unknown check IDs: A, B.')
    })

    test('skips the unknown-ID check when no file is present, echoing the filter with no checks', () => {
      const result = review({}, {checkIds: ['NOT_A_CHECK']})

      expect(result.filter).toEqual({checkIds: ['NOT_A_CHECK']})
      expect(result.checks).toEqual([])
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

describe('securityReview', () => {
  test('records the number of active findings across every check, whatever --check-id selects', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      const unfiltered = testDependencies()
      const filtered = testDependencies()

      await securityReview({directory: appRoot, json: true, verbose: false, checkIds: [], blocking: 'none'}, unfiltered)
      await securityReview(
        {directory: appRoot, json: true, verbose: false, checkIds: ['OPEN_REDIRECT'], blocking: 'none'},
        filtered,
      )

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

      await securityReview(
        {directory: appRoot, json: true, verbose: false, checkIds: [], blocking: 'none'},
        dependencies,
      )

      expect(dependencies.recordMetadata).not.toHaveBeenCalled()
    })
  })

  test('renders the review to the terminal and exits 0 by default', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      const dependencies = testDependencies()

      await securityReview(
        {directory: appRoot, json: false, verbose: true, checkIds: [], blocking: 'none'},
        dependencies,
      )

      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.setExitCode).not.toHaveBeenCalled()
      expect(dependencies.render).toHaveBeenCalledTimes(1)
      const input = dependencies.render.mock.calls[0]![0]
      expect(input.verbose).toBe(true)
      expect(input.now).toBe(now)
      expect(input.commands.scan.args).toContainEqual({flag: '--path', value: relativePath(cwd(), appRoot)})
      expect(input.result.resultsDirectory).toBe(appSecurityArtifactPaths(appRoot, RESULTS_KEY).resultsDirectory)
      expect(input.result.sources.deterministic?.path).toBe(
        appSecurityArtifactPaths(appRoot, RESULTS_KEY).deterministicFindingsPath,
      )
      expect(input.result.checks).toHaveLength(6)
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
      const dependencies = testDependencies()

      await securityReview(
        {directory: appRoot, json: false, verbose: false, checkIds: [], blocking: 'none'},
        dependencies,
      )

      const input = dependencies.render.mock.calls[0]![0]
      expect(input.commands.scan.args.slice(-3)).toEqual([
        {flag: '--include-dir', value: '../backend'},
        {flag: '--exclude', value: 'vendor/**'},
        '--no-git-ignore',
      ])
    })
  })

  test('prints the encoded JSON to stdout instead of rendering', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {deterministic: deterministicFindingsDocument})
      const dependencies = testDependencies()

      await securityReview(
        {directory: appRoot, json: true, verbose: false, checkIds: ['OPEN_REDIRECT'], blocking: 'none'},
        dependencies,
      )

      expect(dependencies.render).not.toHaveBeenCalled()
      expect(dependencies.output).toHaveBeenCalledTimes(1)
      const json = JSON.parse(dependencies.output.mock.calls[0]![0])
      expect(json.filter).toEqual({check_ids: ['OPEN_REDIRECT']})
      expect(json.sources.agent).toBeNull()
      expect(json.sources.deterministic.path).toBe(
        appSecurityArtifactPaths(appRoot, RESULTS_KEY).deterministicFindingsPath,
      )
      expect(json.checks.map((check: {id: string}) => check.id)).toEqual(['OPEN_REDIRECT'])
    })
  })

  test('sets exit code 1 after the output when --blocking is breached', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      const dependencies = testDependencies()
      const order: string[] = []
      dependencies.render.mockImplementation(() => order.push('render'))
      dependencies.setExitCode.mockImplementation((code) => order.push(`exit ${code}`))

      await securityReview(
        {directory: appRoot, json: false, verbose: false, checkIds: [], blocking: 'high'},
        dependencies,
      )

      expect(order).toEqual(['render', 'exit 1'])
    })
  })

  test('sets exit code 1 in JSON mode too', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      const dependencies = testDependencies()

      await securityReview(
        {directory: appRoot, json: true, verbose: false, checkIds: [], blocking: 'low'},
        dependencies,
      )

      expect(dependencies.output).toHaveBeenCalledTimes(1)
      expect(dependencies.setExitCode).toHaveBeenCalledWith(1)
    })
  })

  test('exits 0 with missing files, even with --check-id and --blocking', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {})
      const dependencies = testDependencies()

      await securityReview(
        {directory: appRoot, json: false, verbose: false, checkIds: ['NOT_A_CHECK'], blocking: 'high'},
        dependencies,
      )

      expect(dependencies.setExitCode).not.toHaveBeenCalled()
      const input = dependencies.render.mock.calls[0]![0]
      expect(input.result.sources).toEqual({deterministic: null, agent: null})
      expect(input.result.checks).toEqual([])
      expect(input.result.filter).toEqual({checkIds: ['NOT_A_CHECK']})
    })
  })

  test('aborts on an unknown --check-id without rendering or setting the exit code', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, both)
      const dependencies = testDependencies()

      await expect(
        securityReview(
          {directory: appRoot, json: false, verbose: false, checkIds: ['NOT_A_CHECK'], blocking: 'none'},
          dependencies,
        ),
      ).rejects.toThrow('Unknown check ID: NOT_A_CHECK.')

      expect(dependencies.render).not.toHaveBeenCalled()
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.setExitCode).not.toHaveBeenCalled()
    })
  })

  test('lets the loader abort on an invalid file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory, {deterministic: deterministicFindingsDocument})
      await writeFile(appSecurityArtifactPaths(appRoot, RESULTS_KEY).agentFindingsPath, '{not json')
      const dependencies = testDependencies()

      await expect(
        securityReview({directory: appRoot, json: true, verbose: false, checkIds: [], blocking: 'none'}, dependencies),
      ).rejects.toThrow('The app security check results could not be loaded because a results file is invalid.')

      expect(dependencies.output).not.toHaveBeenCalled()
    })
  })

  test('aborts with "No results found" when the results directory does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await fileRealPath(directory)
      const dependencies = testDependencies()

      await expect(
        securityReview({directory: appRoot, json: false, verbose: false, checkIds: [], blocking: 'none'}, dependencies),
      ).rejects.toMatchObject({message: `No app security check results for ${RESULTS_KEY} in ${appRoot}.`})

      expect(dependencies.render).not.toHaveBeenCalled()
      expect(dependencies.output).not.toHaveBeenCalled()
    })
  })
})

describe('securityReview --client-id lookup', () => {
  const unknownClientId = new AbortError('No app with client ID unknown-client-id found')
  const reviewOptions = {json: true, verbose: false, checkIds: [], blocking: 'none' as const}

  /** The real selection resolver, with the client ID lookup replaced, and a spy on the results loader. */
  function lookUpDependencies(lookUpApp: (clientId: string) => Promise<void>) {
    return {
      ...testDependencies(),
      resolveSelection: (options: AppSecuritySelectionOptions) =>
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
      expect(dependencies.output).toHaveBeenCalled()
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
      expect(dependencies.output).not.toHaveBeenCalled()
      expect(dependencies.render).not.toHaveBeenCalled()
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
