import securityReview, {reviewAppSecurityResults, type SecurityReviewDependencies} from './security-review.js'
import {resolveAppSecurityRoot} from './app-security-api.js'
import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {loadAppSecurityResults} from './app-security-results.js'
import {appSecurityResultsFor} from './app-security-results.test-data.js'
import {
  agentFindingsDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {AppSecurityBlockingLevel} from './app-security-api.js'
import type {AgentFindingsDocument, DeterministicFindingsDocument} from './app-security-engine/index.js'

const now = new Date('2026-09-01T12:30:00.000Z')

interface Files {
  deterministic?: DeterministicFindingsDocument
  agent?: AgentFindingsDocument
}

async function createApp(directory: string, files: Files): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const paths = appSecurityArtifactPaths(directory)
  await mkdir(paths.artifactDirectory)
  if (files.deterministic) await writeFile(paths.deterministicFindingsPath, JSON.stringify(files.deterministic))
  if (files.agent) await writeFile(paths.agentFindingsPath, JSON.stringify(files.agent))
  return directory
}

function testDependencies() {
  const dependencies = {
    resolveRoot: resolveAppSecurityRoot,
    loadResults: loadAppSecurityResults,
    output: vi.fn(),
    render: vi.fn(),
    now: () => now,
    setExitCode: vi.fn(),
  } satisfies SecurityReviewDependencies
  return dependencies
}

function review(files: Files, options: {checkIds?: string[]; blocking?: AppSecurityBlockingLevel} = {}) {
  const results = appSecurityResultsFor('/tmp/review-app', {
    deterministic: files.deterministic ?? null,
    agent: files.agent ?? null,
  })
  return reviewAppSecurityResults(results, {
    appRoot: '/tmp/review-app',
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
      expect(input.commands.scan.args).toContainEqual({flag: '--path', value: appRoot})
      expect(input.result.appRoot).toBe(appRoot)
      expect(input.result.sources.deterministic?.path).toBe(appSecurityArtifactPaths(appRoot).deterministicFindingsPath)
      expect(input.result.checks).toHaveLength(6)
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
      expect(json.sources.deterministic.path).toBe(appSecurityArtifactPaths(appRoot).deterministicFindingsPath)
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
      await writeFile(appSecurityArtifactPaths(appRoot).agentFindingsPath, '{not json')
      const dependencies = testDependencies()

      await expect(
        securityReview({directory: appRoot, json: true, verbose: false, checkIds: [], blocking: 'none'}, dependencies),
      ).rejects.toThrow('The App Security results could not be loaded because a results file is invalid.')

      expect(dependencies.output).not.toHaveBeenCalled()
    })
  })
})
