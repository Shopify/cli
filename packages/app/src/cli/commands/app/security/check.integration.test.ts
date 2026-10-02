import SecurityCheck from './check.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import {Config} from '@oclif/core'
import {fileRealPath, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

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

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

function errorText(stderr: string): string {
  return unstyled(stderr).replaceAll('│', '').replace(/\s+/g, ' ')
}

// The error box wraps long paths across lines, so compare them with whitespace removed.
function expectMentionsPath(message: string, path: string): void {
  expect(message.replaceAll(' ', '')).toContain(path)
}

async function runCommand(argv: string[]) {
  let stdout = ''
  let stderr = ''
  const previousExitCode = process.exitCode
  process.exitCode = 0
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += chunk.toString()
    return true
  })
  const err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += chunk.toString()
    return true
  })
  // Vitest intercepts console.warn; use Node's console to exercise the captured streams.
  const warn = vi.spyOn(console, 'warn').mockImplementation(new Console(process.stdout, process.stderr).warn)
  // Observe the real Oclif error handler's requested exit without terminating the test worker.
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    process.exitCode = code ?? 0
    return undefined as never
  })
  try {
    const config = await Config.load(import.meta.url)
    // This test invokes the app command directly, not as a separately installed CLI plugin.
    config.plugins.clear()
    await SecurityCheck.run(argv, config)
    return {stdout, stderr, exitCode: process.exitCode}
  } finally {
    warn.mockRestore()
    out.mockRestore()
    err.mockRestore()
    exit.mockRestore()
    process.exitCode = previousExitCode
  }
}

describe('app security check command boundary', () => {
  test('scans an app from a nested directory and writes deterministic-findings.json and agent-checks.json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {nestedDirectory} = await createApp(directory)
      const appDirectory = await fileRealPath(directory)
      const paths = appSecurityArtifactPaths(appDirectory, 'shopify.app')

      const result = await runCommand(['--path', nestedDirectory, '--json', '--skip-instructions'])

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout)
      expect(Object.keys(output).sort()).toEqual(['agent_checks_path', 'deterministic_findings', 'engine', 'selection'])
      expect(output.agent_checks_path).toBe(paths.agentChecksPath)
      expect(output.selection).toEqual({
        app_directory: appDirectory,
        app_config_file: joinPath(appDirectory, 'shopify.app.toml'),
        client_id: 'test-client-id',
        client_id_source: 'config',
        scan_directories: [{directory: appDirectory, origin: 'app_directory'}],
      })
      expect(output.engine).toMatchObject({name: 'shopify-app-security'})
      await expect(readJson(paths.deterministicFindingsPath)).resolves.toEqual(output.deterministic_findings)
      await expect(readJson(paths.deterministicFindingsPath)).resolves.toMatchObject({
        schema_version: 1,
        source: 'deterministic',
        engine: {name: 'shopify-app-security'},
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

  test('writes the results under the --client-id results key and creates .shopify/.gitignore', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const appDirectory = await fileRealPath(directory)
      const paths = appSecurityArtifactPaths(appDirectory, 'other-client-id')

      const result = await runCommand([
        '--path',
        directory,
        '--client-id',
        'other-client-id',
        '--json',
        '--skip-instructions',
      ])

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).agent_checks_path).toBe(paths.agentChecksPath)
      await expect(readJson(paths.deterministicFindingsPath)).resolves.toMatchObject({source: 'deterministic'})
      await expect(
        readFile(appSecurityArtifactPaths(appDirectory, 'shopify.app').agentChecksPath),
      ).rejects.toMatchObject({code: 'ENOENT'})
      await expect(readFile(joinPath(appDirectory, '.shopify', '.gitignore'), 'utf8')).resolves.toContain('*')
    })
  })

  test('writes the results under the configuration name without --client-id, per selected configuration', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      await writeFile(joinPath(directory, 'shopify.app.staging.toml'), validAppConfiguration('staging-client-id'))
      const appDirectory = await fileRealPath(directory)

      const result = await runCommand(['--path', directory, '--config', 'staging', '--json', '--skip-instructions'])

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

      const firstScan = await runCommand(['--path', directory, '--json', '--skip-instructions'])
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
      const message = errorText(result.stderr)
      expect(message).toContain("Couldn't find shopify.app.shopifyappdev-dashboardjson.toml in")
      expectMentionsPath(message, normalizePath(await fileRealPath(directory)))
      await expect(readFile(paths.deterministicFindingsPath)).rejects.toMatchObject({code: 'ENOENT'})
    })
  })
})
