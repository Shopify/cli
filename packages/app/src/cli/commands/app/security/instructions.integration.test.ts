import SecurityInstructions from './instructions.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import {Config} from '@oclif/core'
import {fileExists, fileRealPath, inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import clipboard from 'clipboardy'
import {describe, expect, test, vi} from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'

// Skip the installed-CLI error reporting setup, as `check`'s command boundary test does.
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isDevelopment: () => true,
}))
// Command lifecycle telemetry is unrelated to the instructions. Keep the real error handler and renderer.
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()),
  reportAnalyticsEvent: vi.fn(),
}))
// Tests must not replace the clipboard of the machine that runs them.
vi.mock('clipboardy', () => ({default: {write: vi.fn()}}))

/** Creates an app linked to `test-client-id`, without results, and returns its real path. */
async function createApp(directory: string): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), validAppConfiguration('test-client-id'))
  return fileRealPath(directory)
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
      await SecurityInstructions.run(argv, config)
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

/** The instructions as the command prints them without --json, without the line break that ends the output. */
async function printedInstructions(directory: string): Promise<string> {
  const {stdout} = await runCommand(['--path', directory])
  return stdout.replace(/\n$/, '')
}

describe('app security instructions command boundary', () => {
  test('--json writes one result with the selected app, its results directory and the printed instructions', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      const instructions = await printedInstructions(directory)

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
        instructions: {content: instructions, copied: false},
      })
      expect(instructions).toContain('### 1. Run the scan')
      expect(result.stderr).toBe('')
      // Standalone instructions start by running check, which creates the results directory.
      await expect(fileExists(appSecurityArtifactPaths(appDirectory, 'shopify.app').resultsDirectory)).resolves.toBe(
        false,
      )
    })
  })

  test('--copy --json copies the instructions and still includes them in the result', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const instructions = await printedInstructions(directory)

      const result = await runCommand(['--path', directory, '--copy', '--json'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({instructions: {content: instructions, copied: true}})
      expect(result.stderr).toBe('')
      expect(clipboard.write).toHaveBeenCalledExactlyOnceWith(instructions)
    })
  })

  test('--write --json writes the instructions to the file and only its absolute path and format to stdout', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const instructions = await printedInstructions(directory)
      const writePath = joinPath(directory, 'instructions.md')

      const result = await runCommand([
        '--path',
        directory,
        '--write',
        relativePath(resolvePath(), writePath),
        '--json',
      ])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({path: resolve(writePath), format: 'markdown'})
      expect(result.stderr).toBe('')
      await expect(readFile(writePath)).resolves.toBe(`${instructions}\n`)
    })
  })

  test('--copy --json writes one error document with its code and no result when the clipboard fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      vi.mocked(clipboard.write).mockRejectedValue(new Error('Command failed with ENOENT: pbcopy'))

      const result = await runJsonCommand(['--path', directory, '--copy'])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message:
            "Couldn't copy the app security check instructions to the clipboard: Command failed with ENOENT: pbcopy",
          code: 'clipboard-unavailable',
          nextSteps: [
            'Run the command without --copy to print the instructions, or with --write <file> to write them to a file.',
          ],
        },
      })
      expect(result.stderr).toBe('')
    })
  })

  test('--copy without --json shows the error on stderr, prints nothing on stdout and exits 1', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      vi.mocked(clipboard.write).mockRejectedValue(new Error('Command failed with ENOENT: pbcopy'))

      const result = await runCommand(['--path', directory, '--copy'])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(boxText(result.stderr)).toContain(
        "Couldn't copy the app security check instructions to the clipboard: Command failed with ENOENT: pbcopy",
      )
      expect(boxText(result.stderr)).toContain('Run the command without `--copy` to print the instructions')
    })
  })

  test('without --json, prints the instructions on stdout and nothing on stderr', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      const result = await runCommand(['--path', directory])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/^The app security check is Shopify's local security review workflow/)
      expect(result.stderr).toBe('')
    })
  })

  test('--write without --json confirms the written file on stderr and prints nothing on stdout', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const instructions = await printedInstructions(directory)
      const writePath = joinPath(directory, 'instructions.md')

      const result = await runCommand(['--path', directory, '--write', writePath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
      expect(unstyled(result.stderr)).toContain('Wrote app security check instructions to')
      await expect(readFile(writePath)).resolves.toBe(`${instructions}\n`)
    })
  })
})
