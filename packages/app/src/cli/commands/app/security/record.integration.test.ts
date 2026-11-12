import SecurityRecord from './record.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'

// Skip the installed-CLI error reporting setup, as `check`'s command boundary test does.
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isDevelopment: () => true,
}))
// Command lifecycle telemetry is unrelated to recording. Keep the real error handler and renderer.
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()),
  reportAnalyticsEvent: vi.fn(),
}))
// A test can't pipe into the worker's stdin, so each test supplies what the command reads from it.
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  readStdinString: vi.fn(),
}))

const REJECTED_MESSAGE = 'The findings document was rejected. Nothing was recorded.'

const validDocument = {
  schema_version: 1,
  scope: {include_dirs: [], excludes: [], no_git_ignore: false},
  checks_executed: [
    {check_id: 'MISSING_TENANT_ISOLATION', check_version: 1, status: 'executed'},
    {
      check_id: 'OPEN_REDIRECT',
      check_version: 1,
      status: 'not_applicable',
      reason: {code: 'no_redirects', message: 'The app never redirects'},
    },
  ],
  findings: [
    {
      check_id: 'MISSING_TENANT_ISOLATION',
      check_version: 1,
      file: 'app/routes/orders.tsx',
      line: 12,
      message: 'Orders are loaded without a shop filter',
      evidence: [{file: 'app/routes/orders.tsx', line: 12, quote: 'prisma.order.findMany()'}],
    },
  ],
}

/** Creates an app linked to `test-client-id` with the `shopify.app` results directory, and returns its real path. */
async function createApp(directory: string, {withResults = true} = {}): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), validAppConfiguration('test-client-id'))
  const appDirectory = await fileRealPath(directory)
  if (withResults) await mkdir(appSecurityArtifactPaths(appDirectory, 'shopify.app').resultsDirectory)
  return appDirectory
}

function agentFindingsPath(appDirectory: string): string {
  return appSecurityArtifactPaths(appDirectory, 'shopify.app').agentFindingsPath
}

// Boxes wrap text across lines and draw borders, so compare their text with the borders and line breaks removed.
function boxText(output: string): string {
  return unstyled(output).replaceAll('│', '').replace(/\s+/g, ' ')
}

async function runCommand(argv: string[]) {
  const previousExitCode = process.exitCode
  process.exitCode = 0
  // Observe the real Oclif error handler's requested exit without terminating the test worker.
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    process.exitCode = code ?? 0
    return undefined as never
  })
  try {
    const output = await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const config = await Config.load(import.meta.url)
      // This test invokes the app command directly, not as a separately installed CLI plugin.
      config.plugins.clear()
      await SecurityRecord.run(argv, config)
      return {stdout: stdout(), stderr: stderr()}
    })
    return {...output, exitCode: process.exitCode}
  } finally {
    exit.mockRestore()
    process.exitCode = previousExitCode
  }
}

/**
 * Runs the command with --json for a failure. The error handler reads --json from the process arguments, not from the
 * arguments given to `run`, so the environment sets it as well.
 */
async function runJsonCommand(argv: string[]) {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  try {
    return await runCommand([...argv, '--json'])
  } finally {
    vi.unstubAllEnvs()
  }
}

describe('app security record command boundary', () => {
  test('--json records the document and writes one result with the selected app and the recorded file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      vi.mocked(readStdinString).mockResolvedValue(JSON.stringify(validDocument))

      const result = await runCommand(['--path', directory, '--json'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        app: {
          directory: resolve(appDirectory),
          configurationPath: resolve(appDirectory, 'shopify.app.toml'),
          clientId: 'test-client-id',
        },
        resultsDirectory: resolve(appDirectory, '.shopify', 'app-security', 'shopify.app'),
        path: resolve(appDirectory, '.shopify', 'app-security', 'shopify.app', 'agent-findings.json'),
        checkCount: 2,
        findingCount: 1,
      })
      expect(result.stderr).toBe('')
      await expect(fileExists(agentFindingsPath(appDirectory))).resolves.toBe(true)
    })
  })

  test('--json without a document on stdin writes one error document with its code and exits 1', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      vi.mocked(readStdinString).mockResolvedValue(undefined)

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message: 'No findings document was piped on stdin.',
          code: 'findings-document-missing',
          nextSteps: [
            expect.stringMatching(/^Pipe the findings document on stdin: shopify app security record --path .+$/),
          ],
        },
      })
      expect(result.stderr).toBe('')
      await expect(fileExists(agentFindingsPath(appDirectory))).resolves.toBe(false)
    })
  })

  test.each([
    ['invalid JSON', '{"schema_version": 1,', [expect.stringMatching(/^The findings document is not valid JSON: /)]],
    [
      'a document that fails validation',
      JSON.stringify({...validDocument, schema_version: 2, findings: [{...validDocument.findings[0], line: 0}]}),
      ['schema_version must be 1', 'findings[0] (MISSING_TENANT_ISOLATION): invalid line number: 0'],
    ],
    [
      'a document over 5 MB',
      JSON.stringify({...validDocument, padding: 'x'.repeat(5_000_000)}),
      [expect.stringMatching(/^The findings document is \d+ bytes; the limit is 5 MB\.$/)],
    ],
  ])('--json rejects %s with one error document listing every error in its details', async (_case, stdin, errors) => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      vi.mocked(readStdinString).mockResolvedValue(stdin)

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message: REJECTED_MESSAGE,
          code: 'findings-document-rejected',
          nextSteps: [
            expect.stringMatching(/^Fix every error, then run shopify app security record --path .+ again\.$/),
          ],
          customSections: [{title: 'Errors', body: expect.any(String)}],
          details: {errors},
        },
      })
      expect(result.stderr).toBe('')
      await expect(fileExists(agentFindingsPath(appDirectory))).resolves.toBe(false)
    })
  })

  test('--json rejects stdin over the read limit with the read error in the details', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      vi.mocked(readStdinString).mockRejectedValue(new AbortError('Stdin input exceeded the maximum allowed size.'))

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {
          message: REJECTED_MESSAGE,
          code: 'findings-document-rejected',
          details: {errors: ['Stdin input exceeded the maximum allowed size.']},
        },
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json without a results directory writes one error document with its code before reading stdin', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {withResults: false})

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({error: {code: 'results-directory-not-found'}})
      expect(result.stderr).toBe('')
      expect(readStdinString).not.toHaveBeenCalled()
    })
  })

  test('without --json, prints the recorded path on stderr and nothing on stdout', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      vi.mocked(readStdinString).mockResolvedValue(JSON.stringify(validDocument))

      const result = await runCommand(['--path', directory])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(boxText(result.stderr)).toContain('Agent findings recorded. Recorded 2 checks and 1 finding in')
    })
  })
})
