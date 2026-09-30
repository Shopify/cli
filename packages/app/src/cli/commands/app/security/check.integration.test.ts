import SecurityCheck from './check.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {Config} from '@oclif/core'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
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
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Test app"\nclient_id = "test"\n')
  await writeFile(
    joinPath(directory, 'package.json'),
    '{"name":"test-app","dependencies":{"@shopify/shopify-app-react-router":"1.0.0"}}\n',
  )
  await writeFile(joinPath(directory, 'app', 'shopify.server.ts'), 'export const shopify = {}\n')
  await writeFile(joinPath(routesDirectory, 'index.ts'), 'export const loader = () => ({ok: true})')
  return {nestedDirectory: routesDirectory}
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
  test('a plain scan replaces the review pack and scan while earlier artifacts exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {nestedDirectory} = await createApp(directory)
      const paths = appSecurityArtifactPaths(directory)

      const firstScan = await runCommand(['--path', directory, '--json', '--skip-instructions'])
      expect(firstScan.exitCode).toBe(0)

      await writeFile(paths.findingsPath, '{"sentinel":"findings"}\n')
      await writeFile(paths.reviewPath, '{"sentinel":"review"}\n')
      await writeFile(paths.deterministicFindingsPath, '{"sentinel":"scan"}\n')

      const rescan = await runCommand(['--path', nestedDirectory, '--skip-instructions'])

      expect(rescan.exitCode).toBe(0)
      expect(unstyled(rescan.stdout)).not.toMatch(/discard/i)
      await expect(readFile(paths.reviewPath, 'utf8')).resolves.toContain('"checks"')
      await expect(readFile(paths.deterministicFindingsPath, 'utf8')).resolves.toContain('"schema_version"')
      await expect(readFile(paths.findingsPath, 'utf8')).resolves.toBe('{"sentinel":"findings"}\n')
    })
  })
})
