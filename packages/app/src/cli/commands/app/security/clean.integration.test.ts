import SecurityClean from './clean.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import {Config} from '@oclif/core'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'

// Skip the installed-CLI error reporting setup, as `check`'s command boundary test does.
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isDevelopment: () => true,
}))
// Command lifecycle telemetry is unrelated to cleaning. Keep the real error handler and renderer.
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()),
  reportAnalyticsEvent: vi.fn(),
}))

/** Creates an app whose shopify.app.toml is linked to `clientId`, and returns its real path. */
async function createApp(directory: string, clientId = 'test-client-id'): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), validAppConfiguration(clientId))
  return fileRealPath(directory)
}

async function writeResults(appDirectory: string, resultsKey: string): Promise<string> {
  const paths = appSecurityArtifactPaths(appDirectory, resultsKey)
  await mkdir(paths.resultsDirectory)
  await writeFile(paths.deterministicFindingsPath, '{}\n')
  return paths.resultsDirectory
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
      await SecurityClean.run(argv, config)
      return {stdout: stdout(), stderr: stderr()}
    })
    return {...output, exitCode: process.exitCode}
  } finally {
    exit.mockRestore()
    process.exitCode = previousExitCode
  }
}

describe('app security clean command boundary', () => {
  test('--json removes the selected results directory and writes one result with the selected app', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      const resultsDirectory = await writeResults(appDirectory, 'shopify.app')
      const otherResultsDirectory = await writeResults(appDirectory, 'shopify.app.production')

      const result = await runCommand(['--path', directory, '--json'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        changed: true,
        app: {
          directory: resolve(appDirectory),
          configurationPath: resolve(appDirectory, 'shopify.app.toml'),
          clientId: 'test-client-id',
        },
        resultsDirectories: [resolve(resultsDirectory)],
      })
      expect(result.stderr).toBe('')
      await expect(fileExists(resultsDirectory)).resolves.toBe(false)
      await expect(fileExists(otherResultsDirectory)).resolves.toBe(true)
    })
  })

  test('--json with --without-app-config has a null configuration path and the --client-id value', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await fileRealPath(directory)
      const resultsDirectory = await writeResults(appDirectory, 'flag-client-id')

      const result = await runCommand([
        '--path',
        directory,
        '--without-app-config',
        '--client-id',
        'flag-client-id',
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        changed: true,
        app: {directory: resolve(appDirectory), configurationPath: null, clientId: 'flag-client-id'},
        resultsDirectories: [resolve(resultsDirectory)],
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json has a null client ID when the app configuration is not linked', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, '')
      await writeResults(appDirectory, 'shopify.app')

      const result = await runCommand(['--path', directory, '--json'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        app: {configurationPath: resolve(appDirectory, 'shopify.app.toml'), clientId: null},
      })
    })
  })

  test('--all --json removes every results directory and writes a result with only the app directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      const productionResultsDirectory = await writeResults(appDirectory, 'shopify.app.production')
      const resultsDirectory = await writeResults(appDirectory, 'shopify.app')

      const result = await runCommand(['--path', directory, '--all', '--json'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        changed: true,
        app: {directory: resolve(appDirectory)},
        resultsDirectories: [resolve(resultsDirectory), resolve(productionResultsDirectory)],
      })
      expect(result.stderr).toBe('')
      await expect(Promise.all([resultsDirectory, productionResultsDirectory].map(fileExists))).resolves.toEqual([
        false,
        false,
      ])
    })
  })

  test('--all --json with nothing to remove writes a result without a change', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)

      const result = await runCommand(['--path', directory, '--all', '--json'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        changed: false,
        app: {directory: resolve(appDirectory)},
        resultsDirectories: [],
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--json without a results directory writes one error document with its code and exits 1', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      // The error handler reads --json from the process arguments, not from the arguments given to `run`.
      vi.stubEnv('SHOPIFY_FLAG_JSON', '1')

      try {
        const result = await runCommand(['--path', directory, '--json'])

        expect(result.exitCode).toBe(1)
        expect(JSON.parse(result.stdout)).toStrictEqual({
          error: {
            type: 'abort',
            message: `No app security check results for shopify.app in ${appDirectory}.`,
            code: 'results-directory-not-found',
            tryMessage: expect.stringMatching(/^Run `shopify app security check --path .+`\.$/),
          },
        })
        expect(result.stderr).toBe('')
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })

  test('without --json, prints the removed path on stderr and nothing on stdout', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      await writeResults(appDirectory, 'shopify.app')

      const result = await runCommand(['--path', directory])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(boxText(result.stderr)).toContain('App security check results removed.')
    })
  })
})
