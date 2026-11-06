import SecurityCheck from './check.js'
import SecurityReview from './review.js'
import {writeAppSecuritySuppressionsFixture} from '../../../services/app-security-suppressions.test-data.js'
import {storedAgentDocument} from '../../../services/app-security-engine/tests/fixtures/findings-documents.js'
import {appSecurityArtifactPaths, appSecuritySuppressionsPath} from '../../../services/app-security-artifacts.js'
import {deterministicFindingsDocumentSchema} from '../../../services/app-security-engine/results/schema.js'
import {appFromIdentifiers} from '../../../services/context.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import clipboard from 'clipboardy'
import {describe, expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises'
// eslint-disable-next-line no-restricted-imports -- Verify native filesystem paths in JSON output.
import {resolve} from 'node:path'

// Exercise actual stdout/stderr instead of CLI-kit's unit-test log collector.
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isUnitTest: () => false,
  isDevelopment: () => true,
}))
// Command lifecycle telemetry is unrelated to scanning. Keep the real error handler and renderer.
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()),
  reportAnalyticsEvent: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/session')>()),
  setCurrentSessionAlias: vi.fn(),
}))
// The --client-id lookup needs a login and the network. The mock finds every client ID unless a test rejects it.
vi.mock('../../../services/context.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/context.js')>()),
  appFromIdentifiers: vi.fn(),
}))
// Tests answer the prompts. How a real terminal draws them is checked by hand.
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderConfirmationPrompt: vi.fn(),
  renderSelectPrompt: vi.fn(),
}))
// Tests must not replace the clipboard of the machine that runs them.
vi.mock('clipboardy', () => ({default: {write: vi.fn()}}))

async function createApp(directory: string): Promise<{nestedDirectory: string}> {
  const routesDirectory = joinPath(directory, 'app', 'routes')
  await mkdir(routesDirectory, {recursive: true})
  await writeFile(joinPath(directory, 'shopify.app.toml'), validAppConfiguration())
  await writeFile(
    joinPath(directory, 'package.json'),
    '{"name":"test-app","dependencies":{"@shopify/shopify-app-react-router":"1.0.0"}}\n',
  )
  await writeFile(joinPath(directory, 'app', 'shopify.server.ts'), 'export const shopify = {}\n')
  await writeFile(joinPath(routesDirectory, 'index.ts'), 'export const loader = () => ({ok: true})')
  return {nestedDirectory: routesDirectory}
}

/** An app whose source holds a Shopify access token, which the deterministic scan reports as a high finding. */
async function createAppWithSecret(directory: string): Promise<void> {
  await createApp(directory)
  const testToken = ['shpat', '0123456789abcdef0123456789abcdef'].join('_')
  await writeFile(joinPath(directory, 'app', 'routes', 'index.ts'), `const access_token = "${testToken}"\n`)
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

// Boxes wrap text across lines and draw borders, so compare their text with the borders and line breaks removed.
function boxText(output: string): string {
  return unstyled(output).replaceAll('│', '').replace(/\s+/g, ' ')
}

// The error box wraps long paths across lines, so compare them with whitespace removed.
function expectMentionsPath(message: string, path: string): void {
  expect(message.replaceAll(' ', '')).toContain(path)
}

async function runCommand(argv: string[], command: typeof SecurityCheck | typeof SecurityReview = SecurityCheck) {
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
      await command.run(argv, config)
      return {stdout: stdout(), stderr: stderr()}
    })
    return {...output, exitCode: process.exitCode}
  } finally {
    exit.mockRestore()
    process.exitCode = previousExitCode
  }
}

/**
 * Runs the command with --json. CLI Kit's error handler reads --json from the process arguments, not from the
 * arguments given to `run`, so the environment sets it as well.
 */
async function runJsonCommand(argv: string[], command: typeof SecurityCheck | typeof SecurityReview = SecurityCheck) {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  try {
    return await runCommand([...argv, '--json'], command)
  } finally {
    vi.unstubAllEnvs()
  }
}

/** An entry for the access token that `createAppWithSecret` commits, with its code as the results file holds it. */
const committedSecretEntry = {
  source: 'deterministic',
  check: 'COMMITTED_SECRET',
  kind: 'false-positive',
  path: 'app/routes/index.ts',
  code: 'const access_token = "shpa[REDACTED:38]"',
  reason: 'A fake token for the session tests.',
  configurations: ['shopify.app.toml'],
}

/**
 * Runs the command as if stdin and stderr were a terminal, where it prompts unless `--no-input` is passed. CLI Kit reads
 * `--no-input` and `--json` from the process arguments, not from the arguments given to `run`, so the environment sets
 * them as well.
 */
async function runInTerminal(argv: string[], {noInput = false, json = false} = {}) {
  vi.stubEnv('CI', '')
  if (noInput) vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
  if (json) vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const streams = [process.stdin, process.stderr]
  const descriptors = streams.map((stream) => Object.getOwnPropertyDescriptor(stream, 'isTTY'))
  for (const stream of streams) Object.defineProperty(stream, 'isTTY', {value: true, configurable: true})
  try {
    return await runCommand([...argv, ...(noInput ? ['--no-input'] : []), ...(json ? ['--json'] : [])])
  } finally {
    streams.forEach((stream, index) => {
      const descriptor = descriptors[index]
      if (descriptor) {
        Object.defineProperty(stream, 'isTTY', descriptor)
      } else {
        Reflect.deleteProperty(stream, 'isTTY')
      }
    })
    vi.unstubAllEnvs()
  }
}

describe('app security check command boundary', () => {
  test('scans an app from a nested directory and writes deterministic-findings.json and agent-checks.json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {nestedDirectory} = await createApp(directory)
      const appDirectory = await fileRealPath(directory)
      const paths = appSecurityArtifactPaths(appDirectory, 'shopify.app')

      const result = await runCommand(['--path', nestedDirectory, '--skip-instructions'])

      expect(result.exitCode).toBe(0)
      const report = boxText(result.stderr)
      expect(report).toContain('Config file shopify.app.toml')
      expect(report).toContain('Client ID test-client-id')
      await expect(readJson(paths.deterministicFindingsPath)).resolves.toMatchObject({
        schema_version: 1,
        source: 'deterministic',
        engine: {name: 'shopify-app-security'},
        coverage: {scan_directories: [{directory: '.', origin: 'app_directory'}]},
        checks: expect.any(Array),
      })
      await expect(readJson(paths.agentChecksPath)).resolves.toMatchObject({
        schema_version: 1,
        checks: expect.arrayContaining([
          expect.objectContaining({id: expect.any(String), version: expect.any(Number)}),
        ]),
      })
      await expect(readFile(paths.agentFindingsPath)).rejects.toMatchObject({code: 'ENOENT'})
    })
  })

  test('--print-instructions prints only the instructions for the scan that just ran on stdout', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const appDirectory = await fileRealPath(directory)

      const result = await runCommand(['--path', directory, '--print-instructions'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/^The app security check is Shopify's local security review workflow/)
      expect(result.stdout).toContain('### 1. Use the existing scan results')
      expect(result.stdout).toContain(appSecurityArtifactPaths(appDirectory, 'shopify.app').agentChecksPath)
      expect(boxText(result.stderr)).toContain('Config file shopify.app.toml')
    })
  })

  test('scans an extension directory that the TOML adds outside the app directory and records it in coverage', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = joinPath(directory, 'app')
      await createApp(appRoot)
      await writeFile(
        joinPath(appRoot, 'shopify.app.toml'),
        `extension_directories = ["../shared/*"]\n${validAppConfiguration()}`,
      )
      await mkdir(joinPath(directory, 'shared', 'theme', 'blocks'), {recursive: true})
      await writeFile(
        joinPath(directory, 'shared', 'theme', 'shopify.extension.toml'),
        'name = "theme"\ntype = "theme"\n',
      )
      await writeFile(
        joinPath(directory, 'shared', 'theme', 'blocks', 'banner.liquid'),
        '<p>{{ block.settings.text }}</p>\n',
      )
      const appDirectory = await fileRealPath(appRoot)

      const result = await runCommand(['--path', appRoot, '--skip-instructions'])

      expect(result.exitCode).toBe(0)
      const deterministicFindings = await readJson(
        appSecurityArtifactPaths(appDirectory, 'shopify.app').deterministicFindingsPath,
      )
      // `review` reads the results back through this schema.
      expect(deterministicFindingsDocumentSchema.parse(deterministicFindings).coverage).toMatchObject({
        scope: {include_dirs: [], excludes: [], no_git_ignore: false},
        scan_directories: [
          {directory: '.', origin: 'app_directory'},
          {directory: '../shared/theme', origin: 'app_config_directory'},
        ],
      })
    })
  })

  test('writes the results under the --client-id results key and creates .shopify/.gitignore', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const appDirectory = await fileRealPath(directory)
      const paths = appSecurityArtifactPaths(appDirectory, 'other-client-id')

      const result = await runCommand(['--path', directory, '--client-id', 'other-client-id', '--skip-instructions'])

      expect(result.exitCode).toBe(0)
      await expect(readJson(paths.agentChecksPath)).resolves.toMatchObject({checks: expect.any(Array)})
      await expect(readJson(paths.deterministicFindingsPath)).resolves.toMatchObject({source: 'deterministic'})
      await expect(
        readFile(appSecurityArtifactPaths(appDirectory, 'shopify.app').agentChecksPath),
      ).rejects.toMatchObject({code: 'ENOENT'})
      await expect(readFile(joinPath(appDirectory, '.shopify', '.gitignore'), 'utf8')).resolves.toContain('*')
    })
  })

  test('scans without app configuration under the --client-id results key and records the scope', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'index.ts'), 'export const loader = () => ({ok: true})')
      const appDirectory = await fileRealPath(directory)
      const paths = appSecurityArtifactPaths(appDirectory, 'configless-client-id')

      const result = await runCommand([
        '--path',
        directory,
        '--client-id',
        'configless-client-id',
        '--without-app-config',
        '--exclude',
        'vendor',
        '--skip-instructions',
      ])

      expect(result.exitCode).toBe(0)
      const report = boxText(result.stderr)
      expect(report).toContain('Config file none')
      expect(report).toContain('Client ID configless-client-id')
      const deterministicFindings = await readJson(paths.deterministicFindingsPath)
      expect(deterministicFindings).toMatchObject({
        source: 'deterministic',
        coverage: {scope: {include_dirs: [], excludes: ['vendor'], no_git_ignore: false}},
      })
      // With no app configuration, config checks can't run, so they're reported as unresolved rather than passing.
      expect(deterministicFindings).toMatchObject({
        checks: expect.arrayContaining([
          expect.objectContaining({
            status: 'unresolved',
            reason: {code: 'parser_unavailable', message: 'No readable Shopify app configuration was available.'},
          }),
        ]),
      })
      await expect(readJson(paths.agentChecksPath)).resolves.toMatchObject({checks: expect.any(Array)})
    })
  })

  test('writes the results under the configuration name without --client-id, per selected configuration', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await writeFile(joinPath(directory, 'shopify.app.staging.toml'), validAppConfiguration('staging-client-id'))
      const appDirectory = await fileRealPath(directory)

      const result = await runCommand(['--path', directory, '--config', 'staging', '--skip-instructions'])

      expect(result.exitCode).toBe(0)
      const stagingPaths = appSecurityArtifactPaths(appDirectory, 'shopify.app.staging')
      await expect(readJson(stagingPaths.deterministicFindingsPath)).resolves.toMatchObject({source: 'deterministic'})
      await expect(
        readFile(appSecurityArtifactPaths(appDirectory, 'staging-client-id').deterministicFindingsPath),
      ).rejects.toMatchObject({code: 'ENOENT'})
    })
  })

  test('re-scanning replaces the check artifacts without prompting and leaves agent findings untouched', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {nestedDirectory} = await createApp(directory)
      const paths = appSecurityArtifactPaths(directory, 'shopify.app')

      const firstScan = await runCommand(['--path', directory, '--skip-instructions'])
      expect(firstScan.exitCode).toBe(0)

      // Check must not read, validate, or rewrite the agent's findings, so any bytes survive a re-scan.
      const agentFindings = '{"recorded": "by the agent",  "kept": "byte for byte"}'
      await writeFile(paths.agentFindingsPath, agentFindings)
      await writeFile(paths.deterministicFindingsPath, '{"sentinel": "previous scan"}\n')
      await writeFile(paths.agentChecksPath, '{"sentinel": "previous agent checks"}\n')
      await writeFile(joinPath(nestedDirectory, 'index.ts'), 'export const loader = () => ({changed: true})')

      const rescan = await runCommand(['--path', directory, '--skip-instructions'])

      expect(rescan.exitCode).toBe(0)
      expect(unstyled(rescan.stdout)).not.toMatch(/discard/i)
      await expect(readJson(paths.deterministicFindingsPath)).resolves.toMatchObject({
        schema_version: 1,
        source: 'deterministic',
        checks: expect.any(Array),
      })
      await expect(readJson(paths.agentChecksPath)).resolves.toMatchObject({
        schema_version: 1,
        checks: expect.any(Array),
      })
      await expect(readFile(paths.agentFindingsPath, 'utf8')).resolves.toBe(agentFindings)
    })
  })

  test('rejects a missing config', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const paths = appSecurityArtifactPaths(directory, 'shopify.app')

      const result = await runCommand([
        '--path',
        directory,
        '--config',
        'shopify.app.dev-dashboard.json',
        '--skip-instructions',
      ])

      expect(result.exitCode).toBe(1)
      const message = boxText(result.stderr)
      expect(message).toContain("Couldn't find shopify.app.shopifyappdev-dashboardjson.toml in")
      expectMentionsPath(message, normalizePath(await fileRealPath(directory)))
      await expect(readFile(paths.deterministicFindingsPath)).rejects.toMatchObject({code: 'ENOENT'})
    })
  })

  test.each([[['--skip-instructions']], [['--list-files']]])(
    'aborts on an unknown --client-id before writing or listing anything (%j)',
    async (modeFlags) => {
      await inTemporaryDirectory(async (directory) => {
        await createApp(directory)
        const paths = appSecurityArtifactPaths(await fileRealPath(directory), 'unknown-client-id')
        vi.mocked(appFromIdentifiers).mockRejectedValue(new AbortError('No app with client ID unknown-client-id found'))

        const result = await runCommand(['--path', directory, '--client-id', 'unknown-client-id', ...modeFlags])

        expect(result.exitCode).toBe(1)
        expect(boxText(result.stderr)).toContain('No app with client ID unknown-client-id found')
        expect(result.stdout).toBe('')
        expect(appFromIdentifiers).toHaveBeenCalledWith({apiKey: 'unknown-client-id', offerReset: false})
        await expect(fileExists(paths.resultsDirectory)).resolves.toBe(false)
      })
    },
  )

  test('looks up an empty --client-id= before listing anything', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      vi.mocked(appFromIdentifiers).mockRejectedValue(new AbortError('No app with client ID found'))

      const result = await runCommand(['--path', directory, '--client-id=', '--list-files'])

      expect(result.exitCode).toBe(1)
      expect(appFromIdentifiers).toHaveBeenCalledWith({apiKey: '', offerReset: false})
      expect(result.stdout).toBe('')
    })
  })

  test.each([
    {blocking: 'none', exitCode: 0},
    {blocking: 'high', exitCode: 1},
  ])(
    'warns when the instructions cannot be copied, after the report, and exits as --blocking $blocking requires',
    async ({blocking, exitCode}) => {
      await inTemporaryDirectory(async (directory) => {
        await createAppWithSecret(directory)
        vi.mocked(renderSelectPrompt).mockResolvedValue('copy')
        vi.mocked(clipboard.write).mockRejectedValue(new Error('Command failed with ENOENT: pbcopy'))

        const result = await runInTerminal(['--path', directory, '--blocking', blocking])

        expect(result.exitCode).toBe(exitCode)
        expect(result.stdout).toBe('')
        const stderr = boxText(result.stderr)
        expect(stderr).toContain(
          "Couldn't copy the app security check instructions to the clipboard: Command failed with ENOENT: pbcopy",
        )
        expect(stderr).toContain('Run the check again with `--print-instructions` to print them.')
        expect(stderr.indexOf('Config file shopify.app.toml')).toBeLessThan(stderr.indexOf("Couldn't copy"))
        expect(clipboard.write).toHaveBeenCalledOnce()
      })
    },
  )

  test('looks up --client-id, not the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      await runCommand(['--path', directory, '--client-id', 'other-client-id', '--skip-instructions'])
      await runCommand(['--path', directory, '--skip-instructions'])

      expect(appFromIdentifiers).toHaveBeenCalledOnce()
      expect(appFromIdentifiers).toHaveBeenCalledWith({apiKey: 'other-client-id', offerReset: false})
    })
  })
})

/** The JSON stderr events of a run, one per line. */
function jsonEvents(stderr: string): {type: string; level: string; message: string}[] {
  return stderr
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line))
}

/** The result of scanning the app that `createApp` writes, written out independently of the codec. */
async function scanResult(appDirectory: string) {
  const resultsDirectory = resolve(appDirectory, '.shopify', 'app-security', 'shopify.app')
  const agentChecks = (await readJson(resolve(resultsDirectory, 'agent-checks.json'))) as {checks: unknown[]}
  return {
    status: 'success',
    valid: true,
    app: {
      directory: resolve(appDirectory),
      configurationPath: resolve(appDirectory, 'shopify.app.toml'),
      clientId: 'test-client-id',
    },
    resultsDirectory,
    deterministicFindingsPath: resolve(resultsDirectory, 'deterministic-findings.json'),
    agentChecksPath: resolve(resultsDirectory, 'agent-checks.json'),
    scope: {includeDirs: [], excludes: [], noGitIgnore: false},
    scanDirectories: [{directory: resolve(appDirectory), origin: 'app-directory'}],
    agentCheckCount: agentChecks.checks.length,
    blocking: {level: 'none', blockedCheckCount: 0},
    suppressions: {
      filePath: resolve(appDirectory, 'shopify.app-security.json'),
      entryCount: 0,
      suppressedFindingCount: 0,
      staleEntryCount: 0,
      ambiguousEntryCount: 0,
      entries: [],
    },
  }
}

describe('app security check --json command boundary', () => {
  test('writes one result with the app, the files the scan wrote and its scope, without instructions or a report', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const appDirectory = await fileRealPath(directory)

      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual(await scanResult(appDirectory))
      expect(result.stderr).toBe('')
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test('--skip-instructions writes the same result', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const appDirectory = await fileRealPath(directory)

      const result = await runJsonCommand(['--path', directory, '--skip-instructions'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual(await scanResult(appDirectory))
      expect(result.stderr).toBe('')
    })
  })

  test('--print-instructions includes the instructions that the command prints without --json', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const appDirectory = await fileRealPath(directory)
      const printed = await runCommand(['--path', directory, '--print-instructions'])

      const result = await runJsonCommand(['--path', directory, '--print-instructions'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        ...(await scanResult(appDirectory)),
        instructions: {content: printed.stdout.replace(/\n$/, ''), copied: false},
      })
      expect(printed.stdout).toContain('### 1. Use the existing scan results')
      expect(result.stderr).toBe('')
      expect(clipboard.write).not.toHaveBeenCalled()
    })
  })

  test('--list-files writes one result with each gathered file as an absolute native path', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const appDirectory = await fileRealPath(directory)
      const listed = await runCommand(['--path', directory, '--list-files'])

      const result = await runJsonCommand(['--path', directory, '--list-files'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        status: 'success',
        app: {
          directory: resolve(appDirectory),
          configurationPath: resolve(appDirectory, 'shopify.app.toml'),
          clientId: 'test-client-id',
        },
        scope: {includeDirs: [], excludes: [], noGitIgnore: false},
        scanDirectories: [{directory: resolve(appDirectory), origin: 'app-directory'}],
        files: [
          {path: resolve(appDirectory, '.shopify', '.gitignore')},
          {path: resolve(appDirectory, '.shopify', 'project.json')},
          {path: resolve(appDirectory, 'app', 'routes', 'index.ts')},
          {path: resolve(appDirectory, 'app', 'shopify.server.ts')},
          {path: resolve(appDirectory, 'package.json')},
          {path: resolve(appDirectory, 'shopify.app.toml')},
        ],
      })
      // Without --json, the same files are listed relative to the app directory.
      expect(listed.stdout).toBe(
        '.shopify/.gitignore\n.shopify/project.json\napp/routes/index.ts\napp/shopify.server.ts\npackage.json\nshopify.app.toml\n',
      )
      expect(result.stderr).toBe('')
      await expect(fileExists(appSecurityArtifactPaths(appDirectory, 'shopify.app').resultsDirectory)).resolves.toBe(
        false,
      )
    })
  })

  test('reports a --blocking breach as invalid in the result, and exits 1', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)

      const result = await runJsonCommand(['--path', directory, '--blocking', 'high'])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: 'success',
        valid: false,
        blocking: {level: 'high', blockedCheckCount: 1},
      })
    })
  })

  test('reports the same findings as valid with --blocking none, and exits 0', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)

      const result = await runJsonCommand(['--path', directory, '--blocking', 'none'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({valid: true, blocking: {level: 'none', blockedCheckCount: 0}})
    })
  })

  test('passes --blocking when shopify.app-security.json suppresses the finding, also after lines move it', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)
      const blocked = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      await writeAppSecuritySuppressionsFixture(directory, [committedSecretEntry])

      const suppressed = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const source = await readFile(joinPath(directory, 'app', 'routes', 'index.ts'), 'utf8')
      await writeFile(
        joinPath(directory, 'app', 'routes', 'index.ts'),
        `// Session fixtures.\nimport {session} from './session'\n\n${source}`,
      )
      const moved = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const review = await runJsonCommand(['--path', directory, '--check-id', 'COMMITTED_SECRET'], SecurityReview)

      expect(blocked.exitCode).toBe(1)
      expect(JSON.parse(blocked.stdout)).toMatchObject({valid: false, blocking: {level: 'high', blockedCheckCount: 1}})
      for (const result of [suppressed, moved]) {
        expect(result.exitCode).toBe(0)
        expect(JSON.parse(result.stdout)).toMatchObject({valid: true, blocking: {level: 'high', blockedCheckCount: 0}})
      }
      expect(JSON.parse(review.stdout)).toMatchObject({
        checks: [
          {
            id: 'COMMITTED_SECRET',
            findings: [{source: 'deterministic', disposition: 'suppressed', location: {line: 4}}],
          },
        ],
      })
    })
  })

  test('shows a suppressed finding with its kind and reason without --verbose, and reports the entry as JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)
      await writeAppSecuritySuppressionsFixture(directory, [committedSecretEntry])
      const appDirectory = await fileRealPath(directory)

      const text = await runCommand(['--path', directory, '--skip-instructions'])
      const json = await runJsonCommand(['--path', directory])
      const review = await runJsonCommand(['--path', directory, '--check-id', 'COMMITTED_SECRET'], SecurityReview)

      // The app has three other findings: the suppressed high one no longer makes the report an error.
      const report = boxText(text.stderr)
      expect(report).toMatch(/^╭─ warning ─+╮ 3 security issues found\./)
      expect(report).toContain('Suppressed findings 3 active · 1 suppressed')
      expect(report).toContain(
        'app/routes/index.ts:1 · deterministic · false positive · suppressions[0] A fake token for the session tests.',
      )
      // Every entry matched, so no entry is reported as stale, ambiguous or not evaluated.
      expect(report).not.toMatch(/Stale entries|Ambiguous entries|Not evaluated|suppresses nothing/)
      expect(JSON.parse(json.stdout).suppressions).toStrictEqual({
        filePath: resolve(appDirectory, 'shopify.app-security.json'),
        entryCount: 1,
        suppressedFindingCount: 1,
        staleEntryCount: 0,
        ambiguousEntryCount: 0,
        entries: [
          {
            index: 0,
            source: 'deterministic',
            check: 'COMMITTED_SECRET',
            kind: 'false-positive',
            path: resolve(appDirectory, 'app', 'routes', 'index.ts'),
            status: 'matched',
            matchedFindingCount: 1,
            likelyPath: null,
            candidateFindingCount: null,
          },
        ],
      })
      expect(JSON.parse(review.stdout).checks[0].findings).toMatchObject([
        {
          disposition: 'suppressed',
          suppression: {
            justification: 'A fake token for the session tests.',
            origin: 'file',
            entryIndex: 0,
            kind: 'false-positive',
          },
        },
      ])
    })
  })

  test('reports a stale entry with the likely new path of a renamed file, and without one once the code is deleted', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)
      await writeAppSecuritySuppressionsFixture(directory, [committedSecretEntry])
      const appDirectory = await fileRealPath(directory)
      const routes = joinPath(directory, 'app', 'routes')
      await rename(joinPath(routes, 'index.ts'), joinPath(routes, 'session.ts'))

      const renamedJson = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const renamedText = await runCommand(['--path', directory, '--skip-instructions'])
      await writeFile(joinPath(routes, 'session.ts'), 'export const accessToken = process.env.SHOPIFY_ACCESS_TOKEN\n')
      const deletedJson = await runJsonCommand(['--path', directory])

      // The entry still applies to nothing, so the token in the renamed file fails --blocking.
      expect(renamedJson.exitCode).toBe(1)
      expect(JSON.parse(renamedJson.stdout)).toMatchObject({
        valid: false,
        blocking: {blockedCheckCount: 1},
        suppressions: {
          suppressedFindingCount: 0,
          staleEntryCount: 1,
          ambiguousEntryCount: 0,
          entries: [
            {
              status: 'stale',
              matchedFindingCount: 0,
              likelyPath: resolve(appDirectory, 'app', 'routes', 'session.ts'),
              candidateFindingCount: null,
            },
          ],
        },
      })
      const report = boxText(renamedText.stderr)
      expect(report).toContain(
        'Stale entries in shopify.app-security.json • suppressions[0]: deterministic COMMITTED_SECRET in app/routes/index.ts · false positive A fake token for the session tests. Maybe moved to app/routes/session.ts',
      )
      expect(report).toContain('This entry matches no finding. Remove it, or update it to match the code.')
      expect(JSON.parse(deletedJson.stdout).suppressions).toMatchObject({
        staleEntryCount: 1,
        entries: [{status: 'stale', likelyPath: null}],
      })
    })
  })

  test('reports an entry whose code matches two findings as ambiguous, with both locations, and suppresses neither', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const testToken = ['shpat', '0123456789abcdef0123456789abcdef'].join('_')
      await writeFile(
        joinPath(directory, 'app', 'routes', 'index.ts'),
        `const access_token = "${testToken}"\nconst refresh_token = "${testToken}"\n`,
      )
      await writeAppSecuritySuppressionsFixture(directory, [{...committedSecretEntry, code: '"shpa[REDACTED:38]"'}])

      const json = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const text = await runCommand(['--path', directory, '--skip-instructions'])

      expect(json.exitCode).toBe(1)
      expect(JSON.parse(json.stdout)).toMatchObject({
        valid: false,
        suppressions: {
          suppressedFindingCount: 0,
          staleEntryCount: 0,
          ambiguousEntryCount: 1,
          entries: [{status: 'ambiguous', matchedFindingCount: 0, likelyPath: null, candidateFindingCount: 2}],
        },
      })
      const report = boxText(text.stderr)
      expect(report).toContain(
        'Ambiguous entries in shopify.app-security.json • suppressions[0]: deterministic COMMITTED_SECRET in app/routes/index.ts · matches 2 findings At app/routes/index.ts:1, app/routes/index.ts:2',
      )
      expect(report).toContain('This entry suppresses nothing. Give it a more specific code that matches one finding.')
      expect(report).not.toContain('Suppressed findings')
      expect(json.stdout + text.stdout + text.stderr).not.toContain(testToken)
    })
  })

  test('counts agent entries and entries for another configuration as not evaluated, never as stale', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)
      await writeAppSecuritySuppressionsFixture(directory, [
        {...committedSecretEntry, source: 'agent', check: 'CREDENTIAL_LOG_LEAKAGE', code: 'console.log(session)'},
        {...committedSecretEntry, configurations: ['shopify.app.staging.toml']},
      ])

      const json = await runJsonCommand(['--path', directory])
      const text = await runCommand(['--path', directory, '--skip-instructions'])

      expect(JSON.parse(json.stdout).suppressions).toMatchObject({
        staleEntryCount: 0,
        ambiguousEntryCount: 0,
        entries: [
          {index: 0, status: 'not-evaluated', likelyPath: null, candidateFindingCount: null},
          {index: 1, status: 'not-evaluated', likelyPath: null, candidateFindingCount: null},
        ],
      })
      const report = boxText(text.stderr)
      expect(report).toContain(
        'Not evaluated: 2 entries (1 for a check without an executed result, 1 for other app configurations).',
      )
      expect(report).not.toMatch(/Stale entries|Ambiguous entries/)
    })
  })

  test('passes --blocking when an entry suppresses the deterministic finding of a prefer-agent check', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await writeFile(
        joinPath(directory, 'app', 'routes', 'index.ts'),
        'export async function loader({request}) {\n  const {session} = await authenticate.admin(request)\n  console.log(session.accessToken)\n  return null\n}\n',
      )
      const blocked = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      await writeAppSecuritySuppressionsFixture(directory, [
        {
          ...committedSecretEntry,
          check: 'CREDENTIAL_LOG_LEAKAGE',
          kind: 'accepted-risk',
          code: 'console.log(session.accessToken)',
          reason: 'Logged only in local development.',
        },
      ])

      const suppressed = await runJsonCommand(['--path', directory, '--blocking', 'high'])

      expect(JSON.parse(blocked.stdout)).toMatchObject({valid: false, blocking: {blockedCheckCount: 1}})
      expect(suppressed.exitCode).toBe(0)
      expect(JSON.parse(suppressed.stdout)).toMatchObject({valid: true, blocking: {blockedCheckCount: 0}})
    })
  })

  test('passes --blocking after review --suppress saves an entry for the scanned finding, also after lines move it', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)
      const blocked = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const before = JSON.parse((await runJsonCommand(['--path', directory], SecurityReview)).stdout)
      const secretCheck = before.checks.find((check: {id: string}) => check.id === 'COMMITTED_SECRET')

      const suppressed = await runJsonCommand(
        [
          '--path',
          directory,
          '--suppress',
          String(secretCheck.findings[0].number),
          '--kind',
          'false-positive',
          '--reason',
          'A fake token for the session tests.',
          '--results-digest',
          before.resultsDigest,
        ],
        SecurityReview,
      )
      const passed = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const source = await readFile(joinPath(directory, 'app', 'routes', 'index.ts'), 'utf8')
      await writeFile(
        joinPath(directory, 'app', 'routes', 'index.ts'),
        `// Session fixtures.\nimport {session} from './session'\n\n${source}`,
      )
      const moved = await runJsonCommand(['--path', directory, '--blocking', 'high'])

      expect(blocked.exitCode).toBe(1)
      expect(suppressed.exitCode).toBe(0)
      // The entry names the redacted line that the results hold, never the token.
      expect(JSON.parse(suppressed.stdout).savedSuppressions.entries).toMatchObject([
        {source: 'deterministic', check: 'COMMITTED_SECRET', code: 'const access_token = "shpa[REDACTED:38]"'},
      ])
      await expect(readFile(appSecuritySuppressionsPath(directory), 'utf8')).resolves.not.toContain('0123456789abcdef')
      for (const result of [passed, moved]) {
        expect(result.exitCode).toBe(0)
        expect(JSON.parse(result.stdout)).toMatchObject({
          valid: true,
          suppressions: {entries: [{status: 'matched', matchedFindingCount: 1}]},
        })
      }
    })
  })

  test('passes --blocking only after review --suppress also saves the companion of a prefer-agent finding', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const routeLines = [
        'export async function loader({request}) {',
        '  const {session} = await authenticate.admin(request)',
        '  console.log(session.accessToken)',
        '  return null',
        '}',
      ]
      await writeFile(joinPath(directory, 'app', 'routes', 'index.ts'), `${routeLines.join('\n')}\n`)
      await runJsonCommand(['--path', directory])
      const {agentFindingsPath} = appSecurityArtifactPaths(await fileRealPath(directory), 'shopify.app')
      await writeFile(
        agentFindingsPath,
        JSON.stringify(
          storedAgentDocument({
            checkId: 'CREDENTIAL_LOG_LEAKAGE',
            // Newer than the scan, so this result supersedes the deterministic finding.
            generatedAt: new Date(Date.now() + 60_000).toISOString(),
            precedence: 'prefer-agent',
            findings: [
              {
                location: {file: 'app/routes/index.ts', line: 3},
                message: 'The session access token is written to the server log.',
                evidence: [{location: {file: 'app/routes/index.ts', line: 3}}],
                code_excerpt: routeLines.map((text, index) => ({line: index + 1, text})),
              },
            ],
          }),
        ),
      )
      const review = JSON.parse((await runJsonCommand(['--path', directory], SecurityReview)).stdout)
      const findings = review.checks.find((check: {id: string}) => check.id === 'CREDENTIAL_LOG_LEAKAGE').findings
      const agentNumber = findings.find((finding: {source: string}) => finding.source === 'agent').number
      const deterministicNumber = findings.find(
        (finding: {source: string}) => finding.source === 'deterministic',
      ).number
      const suppressFlags = ['--path', directory, '--suppress', String(agentNumber), '--kind', 'accepted-risk']
      const reason = ['--reason', 'Logged only in local development.']

      const alone = await runJsonCommand([...suppressFlags, ...reason], SecurityReview)
      const stillBlocked = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const withCompanion = await runJsonCommand([...suppressFlags, ...reason, '--include-superseded'], SecurityReview)
      const passed = await runJsonCommand(['--path', directory, '--blocking', 'high'])

      expect(JSON.parse(alone.stdout).savedSuppressions).toMatchObject({
        entries: [{source: 'agent', findingNumber: agentNumber}],
        companionFindingNumbers: [deterministicNumber],
      })
      expect(JSON.parse(stillBlocked.stdout)).toMatchObject({valid: false, blocking: {blockedCheckCount: 1}})
      expect(JSON.parse(withCompanion.stdout).savedSuppressions).toMatchObject({
        entries: [
          {
            index: 1,
            source: 'deterministic',
            check: 'CREDENTIAL_LOG_LEAKAGE',
            code: 'console.log(session.accessToken)',
            kind: 'accepted-risk',
            reason: 'Logged only in local development.',
            findingNumber: deterministicNumber,
          },
        ],
        companionFindingNumbers: [],
      })
      expect(passed.exitCode).toBe(0)
      expect(JSON.parse(passed.stdout)).toMatchObject({valid: true, blocking: {blockedCheckCount: 0}})
    })
  })

  test('passes --blocking after review --suppress saves an entry for a superseded finding that no agent finding anchors', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await writeFile(
        joinPath(directory, 'app', 'routes', 'index.ts'),
        'export async function loader({request}) {\n  const {session} = await authenticate.admin(request)\n  console.log(session.accessToken)\n  return null\n}\n',
      )
      await runJsonCommand(['--path', directory])
      const {agentFindingsPath} = appSecurityArtifactPaths(await fileRealPath(directory), 'shopify.app')
      await writeFile(
        agentFindingsPath,
        JSON.stringify({
          schema_version: 1,
          source: 'agent',
          engine: {name: 'shopify-app-security', version: '4.9.0'},
          // Newer than the scan, so the prefer-agent result supersedes the deterministic finding.
          generated_at: new Date(Date.now() + 60_000).toISOString(),
          scope: {include_dirs: [], excludes: [], no_git_ignore: false},
          // The agent found nothing, so no agent finding anchors a companion for the deterministic one.
          checks: [
            {
              id: 'CREDENTIAL_LOG_LEAKAGE',
              version: 1,
              status: 'executed',
              snapshot: {
                title: 'Credential reaches a log sink',
                severity: 'high',
                description: 'Detects direct credential flows to console and logger sinks.',
                current_version: 1,
                precedence: 'prefer-agent',
              },
              findings: [],
            },
          ],
        }),
      )
      const before = JSON.parse((await runJsonCommand(['--path', directory], SecurityReview)).stdout)
      const credentialCheck = (review: {checks: {id: string; findings: unknown[]}[]}) =>
        review.checks.find((check) => check.id === 'CREDENTIAL_LOG_LEAKAGE')
      const [superseded] = credentialCheck(before)!.findings as {number: number; disposition: string}[]
      const blocked = await runJsonCommand(['--path', directory, '--blocking', 'high'])

      const suppressed = await runJsonCommand(
        [
          '--path',
          directory,
          '--suppress',
          String(superseded!.number),
          '--kind',
          'accepted-risk',
          '--reason',
          'Logged only in local development.',
          '--results-digest',
          before.resultsDigest,
        ],
        SecurityReview,
      )
      const passed = await runJsonCommand(['--path', directory, '--blocking', 'high'])
      const after = JSON.parse((await runJsonCommand(['--path', directory], SecurityReview)).stdout)

      expect(superseded).toMatchObject({disposition: 'superseded', suppression: null})
      expect(JSON.parse(blocked.stdout)).toMatchObject({valid: false, blocking: {blockedCheckCount: 1}})
      expect(suppressed.exitCode).toBe(0)
      expect(JSON.parse(suppressed.stdout).savedSuppressions).toMatchObject({
        entries: [
          {
            index: 0,
            change: 'added',
            source: 'deterministic',
            check: 'CREDENTIAL_LOG_LEAKAGE',
            code: 'console.log(session.accessToken)',
            kind: 'accepted-risk',
            reason: 'Logged only in local development.',
            findingNumber: superseded!.number,
          },
        ],
        companionFindingNumbers: [],
      })
      expect(passed.exitCode).toBe(0)
      expect(JSON.parse(passed.stdout)).toMatchObject({
        valid: true,
        blocking: {blockedCheckCount: 0},
        suppressions: {entries: [{status: 'matched', matchedFindingCount: 1}]},
      })
      // The review still shows the finding as superseded, with the entry that suppresses it for check --blocking.
      expect(credentialCheck(after)!.findings).toMatchObject([
        {
          number: superseded!.number,
          disposition: 'superseded',
          suppression: {origin: 'file', entryIndex: 0, kind: 'accepted-risk'},
        },
      ])
      expect(after.suppressions.entries).toMatchObject([{index: 0, status: 'matched', matchedFindingCount: 1}])
    })
  })

  test('aborts with one error document when shopify.app-security.json is invalid, and writes no results', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithSecret(directory)
      await writeFile(
        appSecuritySuppressionsPath(directory),
        JSON.stringify({schema_version: 1, suppressions: [{...committedSecretEntry, reason: undefined}]}),
      )

      const result = await runJsonCommand(['--path', directory, '--blocking', 'high'])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {
          type: 'abort',
          message: 'The app security suppressions could not be loaded because shopify.app-security.json is invalid.',
          code: 'suppressions-file-invalid',
          details: {
            path: resolve(await fileRealPath(directory), 'shopify.app-security.json'),
            errors: ['suppressions[0].reason: required'],
          },
        },
      })
      await expect(fileExists(appSecurityArtifactPaths(directory, 'shopify.app').resultsDirectory)).resolves.toBe(false)
    })
  })

  test('reports gathering warnings as events on stderr', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await mkdir(joinPath(directory, 'apps', 'child'), {recursive: true})
      await writeFile(joinPath(directory, 'apps', 'child', 'shopify.app.toml'), 'name = "Child"\n')
      vi.stubEnv('INIT_CWD', await fileRealPath(directory))

      const result = await runJsonCommand(['--path', directory, '--list-files'])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({status: 'success', files: expect.any(Array)})
      expect(jsonEvents(result.stderr)).toEqual([
        {
          type: 'diagnostic',
          timestamp: expect.any(String),
          level: 'warning',
          message: expect.stringContaining("apps/child holds another app's configuration"),
        },
      ])
    })
  })

  test('aborts with one error document when there is no app configuration and prompts are off', async () => {
    await inTemporaryDirectory(async (directory) => {
      const result = await runJsonCommand(['--path', directory])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: {type: 'abort', message: `No app configuration found at or above ${directory}.`},
      })
    })
  })
})

describe('app security check prompts', () => {
  /** An app with two configurations and none selected, so the check asks which one to scan. */
  async function createAppWithTwoConfigurations(directory: string): Promise<void> {
    await createApp(directory)
    await writeFile(joinPath(directory, 'shopify.app.production.toml'), validAppConfiguration('production-client-id'))
    await writeFile(joinPath(directory, 'shopify.app.staging.toml'), validAppConfiguration('staging-client-id'))
    await rm(joinPath(directory, 'shopify.app.toml'))
  }

  describe.each([{json: false}, {json: true}])('with json: $json', ({json}) => {
    test.each([
      {answer: 'copy', copied: true},
      {answer: 'print', copied: false},
    ] as const)('delivers the instructions when $answer is chosen', async ({answer, copied}) => {
      await inTemporaryDirectory(async (directory) => {
        await createApp(directory)
        vi.mocked(renderSelectPrompt).mockResolvedValue(answer)

        const result = await runInTerminal(['--path', directory], {json})

        expect(result.exitCode).toBe(0)
        expect(renderSelectPrompt).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            choices: json
              ? [
                  {label: 'Include instructions in the JSON output and copy them to the clipboard', value: 'copy'},
                  {label: 'Include instructions in the JSON output', value: 'print'},
                  {label: 'Nothing', value: 'nothing'},
                ]
              : [
                  {label: 'Copy instructions to the clipboard', value: 'copy'},
                  {label: 'Print instructions to the terminal', value: 'print'},
                  {label: 'Nothing', value: 'nothing'},
                ],
          }),
        )
        expect(vi.mocked(clipboard.write).mock.calls).toHaveLength(copied ? 1 : 0)
        const instructions = copied ? vi.mocked(clipboard.write).mock.calls[0]![0] : undefined
        if (json) {
          const output = JSON.parse(result.stdout)
          expect(output.instructions).toEqual({content: expect.stringContaining('### 1. Use the existing'), copied})
          if (copied) expect(output.instructions.content).toBe(instructions)
          expect(result.stderr).toBe('')
        } else if (copied) {
          expect(result.stdout).toBe('')
          expect(unstyled(result.stderr)).toContain('Copied app security check instructions to the clipboard')
        } else {
          expect(result.stdout).toContain('### 1. Use the existing scan results')
        }
      })
    })

    test('gives nothing when Nothing is chosen', async () => {
      await inTemporaryDirectory(async (directory) => {
        await createApp(directory)
        vi.mocked(renderSelectPrompt).mockResolvedValue('nothing')

        const result = await runInTerminal(['--path', directory], {json})

        expect(result.exitCode).toBe(0)
        expect(renderSelectPrompt).toHaveBeenCalledOnce()
        expect(clipboard.write).not.toHaveBeenCalled()
        if (json) {
          expect(JSON.parse(result.stdout)).toStrictEqual(await scanResult(await fileRealPath(directory)))
        } else {
          expect(result.stdout).toBe('')
        }
      })
    })

    test('offers no instructions with --no-input', async () => {
      await inTemporaryDirectory(async (directory) => {
        await createApp(directory)

        const result = await runInTerminal(['--path', directory], {json, noInput: true})

        expect(result.exitCode).toBe(0)
        expect(renderSelectPrompt).not.toHaveBeenCalled()
        if (json) {
          expect(JSON.parse(result.stdout)).toStrictEqual(await scanResult(await fileRealPath(directory)))
        } else {
          expect(result.stdout).toBe('')
        }
      })
    })

    test('scans without app configuration when that is accepted, after showing how to skip the prompt', async () => {
      await inTemporaryDirectory(async (directory) => {
        vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
        vi.mocked(renderSelectPrompt).mockResolvedValue('nothing')

        const result = await runInTerminal(['--path', directory, '--client-id', 'flag-client-id'], {json})

        expect(result.exitCode).toBe(0)
        expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
        if (json) {
          expect(JSON.parse(result.stdout)).toMatchObject({
            status: 'success',
            app: {
              directory: resolve(await fileRealPath(directory)),
              configurationPath: null,
              clientId: 'flag-client-id',
            },
          })
          expect(jsonEvents(result.stderr)).toEqual([
            {
              type: 'diagnostic',
              timestamp: expect.any(String),
              level: 'info',
              message: expect.stringMatching(
                /^To skip these prompts next time, run:\n\nshopify app security check .* --client-id ["']?flag-client-id["']? --without-app-config$/,
              ),
            },
          ])
        } else {
          expect(result.stdout).toBe('')
          expect(boxText(result.stderr)).toContain('To skip these prompts next time, run:')
          expect(boxText(result.stderr)).toContain('Config file none')
        }
      })
    })

    test('scans nothing and exits 0 when scanning without app configuration is declined', async () => {
      await inTemporaryDirectory(async (directory) => {
        vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

        const result = await runInTerminal(['--path', directory], {json})

        expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
        expect(renderSelectPrompt).not.toHaveBeenCalled()
        expect(result.exitCode).toBe(0)
        if (json) {
          expect(JSON.parse(result.stdout)).toStrictEqual({status: 'cancelled'})
          expect(result.stderr).toBe('')
        } else {
          expect(result.stdout).toBe('')
          expect(boxText(result.stderr)).toContain('No app configuration found at or above')
          expect(boxText(result.stderr)).toContain('--without-app-config --client-id <client-id>')
        }
        await expect(fileExists(joinPath(directory, '.shopify', 'app-security'))).resolves.toBe(false)
      })
    })

    test('aborts without asking when there is no app configuration and --no-input is passed', async () => {
      await inTemporaryDirectory(async (directory) => {
        const result = await runInTerminal(['--path', directory], {json, noInput: true})

        expect(result.exitCode).toBe(1)
        expect(renderConfirmationPrompt).not.toHaveBeenCalled()
        if (json) {
          expect(JSON.parse(result.stdout)).toMatchObject({
            error: {type: 'abort', message: `No app configuration found at or above ${directory}.`},
          })
        } else {
          expect(result.stdout).toBe('')
          expect(boxText(result.stderr)).toContain('No app configuration found at or above')
        }
      })
    })
  })

  test('--json shows how to skip the prompts as an event after asking which configuration to scan', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createAppWithTwoConfigurations(directory)
      vi.mocked(renderSelectPrompt).mockResolvedValueOnce('shopify.app.staging.toml').mockResolvedValueOnce('nothing')

      const result = await runInTerminal(['--path', directory], {json: true})

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        app: {configurationPath: resolve(await fileRealPath(directory), 'shopify.app.staging.toml')},
      })
      expect(jsonEvents(result.stderr)).toEqual([
        {
          type: 'diagnostic',
          timestamp: expect.any(String),
          level: 'info',
          message: expect.stringMatching(
            /^To skip these prompts next time, run:\n\nshopify app security check .* --config ["']?staging["']?$/,
          ),
        },
      ])
    })
  })

  test.each([
    {blocking: 'none', valid: true, exitCode: 0},
    {blocking: 'high', valid: false, exitCode: 1},
  ])(
    '--json warns on stderr when the instructions cannot be copied, still includes them, and exits as --blocking $blocking requires',
    async ({blocking, valid, exitCode}) => {
      await inTemporaryDirectory(async (directory) => {
        await createAppWithSecret(directory)
        vi.mocked(renderSelectPrompt).mockResolvedValue('copy')
        vi.mocked(clipboard.write).mockRejectedValue(new Error('Command failed with ENOENT: pbcopy'))

        const result = await runInTerminal(['--path', directory, '--blocking', blocking], {json: true})

        expect(result.exitCode).toBe(exitCode)
        expect(JSON.parse(result.stdout)).toMatchObject({
          valid,
          instructions: {content: expect.stringContaining('### 1. Use the existing'), copied: false},
        })
        expect(jsonEvents(result.stderr)).toEqual([
          {
            type: 'diagnostic',
            timestamp: expect.any(String),
            level: 'warning',
            message:
              "Couldn't copy the app security check instructions to the clipboard: Command failed with ENOENT: pbcopy\n\nThe result still includes them.",
          },
        ])
      })
    },
  )
})
