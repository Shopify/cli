import SecurityCheck from './check.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {Config} from '@oclif/core'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
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

interface ReviewPack {
  source_scan_id: string
  checks: {id: string; version: number; prompt_hash: string}[]
}

interface Trace {
  findings: {source: string; check_id?: string}[]
  checks_executed: {kind: string; id: string; status: string}[]
}

const reviewedCheckId = 'MISSING_TENANT_ISOLATION'

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

async function readReviewPack(reviewPath: string): Promise<ReviewPack> {
  return JSON.parse(await readFile(reviewPath, 'utf8')) as ReviewPack
}

function findingsDocument(reviewPack: ReviewPack): string {
  const check = reviewPack.checks.find((entry) => entry.id === reviewedCheckId)
  if (!check) throw new Error(`Missing review pack check ${reviewedCheckId}`)
  const identity = {check_id: check.id, check_version: check.version, prompt_hash: check.prompt_hash}
  return `${JSON.stringify({
    schema_version: 1,
    source_scan_id: reviewPack.source_scan_id,
    checks_executed: [{...identity, status: 'executed', inspected_files: ['app/routes/index.ts']}],
    findings: [
      {
        ...identity,
        file: 'app/routes/index.ts',
        line: 1,
        message: 'The query is not scoped to the current shop.',
        evidence: [{file: 'app/routes/index.ts', line: 1, quote: 'loader'}],
      },
    ],
  })}\n`
}

// Byte snapshot of every local artifact so a refused scan can be proven to leave them untouched.
async function artifactBytes(paths: Record<'tracePath' | 'reviewPath' | 'findingsPath' | 'submissionPath', string>) {
  const readOrMissing = async (path: string) => readFile(path).catch(() => 'missing')
  return {
    trace: await readOrMissing(paths.tracePath),
    review: await readOrMissing(paths.reviewPath),
    findings: await readOrMissing(paths.findingsPath),
    submission: await readOrMissing(paths.submissionPath),
  }
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
  test('refuses a plain scan once findings from a custom path are compiled, even after that file is gone', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (findingsDirectory) => {
        const {nestedDirectory} = await createApp(directory)
        const paths = appSecurityArtifactPaths(directory)

        const scan = await runCommand(['--path', directory, '--json', '--skip-instructions'])
        expect(scan.exitCode).toBe(0)
        expect(JSON.parse(scan.stdout)).toMatchObject({operation: 'scan'})

        const customFindingsPath = joinPath(findingsDirectory, 'agent-findings.json')
        await writeFile(customFindingsPath, findingsDocument(await readReviewPack(paths.reviewPath)))
        const compile = await runCommand([
          '--path',
          directory,
          '--findings',
          customFindingsPath,
          '--json',
          '--skip-instructions',
        ])
        expect(compile.exitCode).toBe(0)
        expect(JSON.parse(compile.stdout)).toMatchObject({operation: 'compile'})
        const trace = JSON.parse(await readFile(paths.tracePath, 'utf8')) as Trace
        expect(trace.findings).toContainEqual(expect.objectContaining({source: 'agent', check_id: reviewedCheckId}))
        expect(trace.checks_executed).toContainEqual(
          expect.objectContaining({kind: 'agent', id: reviewedCheckId, status: 'executed'}),
        )

        await rm(customFindingsPath)
        await expect(readFile(paths.findingsPath)).rejects.toMatchObject({code: 'ENOENT'})
        await writeFile(paths.submissionPath, '{"sentinel":"submission"}\n')
        const before = await artifactBytes(paths)

        const refused = await runCommand(['--path', nestedDirectory, '--skip-instructions'])
        expect(refused.exitCode).toBe(1)
        expect(refused.stdout).toBe('')
        const message = errorText(refused.stderr)
        expect(message).toContain('App Security did not start a new scan.')
        expect(message).toContain('The existing trace contains agent review results:')
        expectMentionsPath(message, paths.tracePath)
        expect(message).toContain('--clean')
        await expect(artifactBytes(paths)).resolves.toEqual(before)
        expect(before.findings).toBe('missing')
      })
    })
  })

  test('rejects a missing config before reporting a protected trace', async () => {
    await inTemporaryDirectory(async (directory) => {
      const paths = appSecurityArtifactPaths(directory)
      await createApp(directory)

      const scan = await runCommand(['--path', directory, '--json', '--skip-instructions'])
      expect(scan.exitCode).toBe(0)

      await writeFile(paths.findingsPath, findingsDocument(await readReviewPack(paths.reviewPath)))
      const compile = await runCommand([
        '--path',
        directory,
        '--findings',
        paths.findingsPath,
        '--json',
        '--skip-instructions',
      ])
      expect(compile.exitCode).toBe(0)

      const refused = await runCommand([
        '--path',
        directory,
        '--config',
        'shopify.app.dev-dashboard.json',
        '--skip-instructions',
      ])

      expect(refused.exitCode).toBe(1)
      const message = errorText(refused.stderr)
      expect(message).toContain("Couldn't find app configuration at")
      expectMentionsPath(message, joinPath(directory, 'shopify.app.shopifyappdev-dashboardjson.toml'))
    })
  })

  test('refuses a plain scan while default agent findings are pending', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {nestedDirectory} = await createApp(directory)
      const paths = appSecurityArtifactPaths(directory)

      const scan = await runCommand(['--path', directory, '--json', '--skip-instructions'])
      expect(scan.exitCode).toBe(0)
      expect(JSON.parse(scan.stdout)).toMatchObject({operation: 'scan'})

      await writeFile(paths.findingsPath, findingsDocument(await readReviewPack(paths.reviewPath)))
      await writeFile(paths.submissionPath, '{"sentinel":"submission"}\n')
      const before = await artifactBytes(paths)

      const refused = await runCommand(['--path', nestedDirectory, '--skip-instructions'])
      expect(refused.exitCode).toBe(1)
      expect(refused.stdout).toBe('')
      const message = errorText(refused.stderr)
      expect(message).toContain('App Security did not start a new scan.')
      expect(message).toContain('Agent findings exist at:')
      expectMentionsPath(message, paths.findingsPath)
      expect(message).toContain('--findings')
      expect(message).toContain('--clean')
      await expect(artifactBytes(paths)).resolves.toEqual(before)
    })
  })

  test('rejects --clean together with --findings before touching the app', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)
      const paths = appSecurityArtifactPaths(directory)

      const result = await runCommand(['--path', directory, '--clean', '--findings', 'findings.json'])

      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('--findings')
      expect(result.stderr).toContain('--clean')
      await expect(readFile(paths.tracePath)).rejects.toMatchObject({code: 'ENOENT'})
    })
  })
})
