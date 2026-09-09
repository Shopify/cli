import DoctorSubmit from './submit.js'
import {appDoctorArtifactPaths} from '../../../services/app-doctor-artifacts.js'
import {resolveDoctorSubmitClientId} from '../../../services/app-doctor-submit-target.js'
import {clearCachedAppInfo, setCachedAppInfo} from '../../../services/local-storage.js'
import {submissionTraceFixture} from '../../../services/app-doctor-engine/tests/fixtures/submission-trace.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {defaultDeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {fetch, FetchError, Response} from '@shopify/cli-kit/node/http'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readStdinString, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {describe, expect, test, vi} from 'vitest'
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises'
import type {
  DeveloperPlatformClient,
  SourceScanCreateSchema,
  SourceScanUploadUrlSchema,
} from '../../../utilities/developer-platform-client.js'

vi.mock('../../../services/app-doctor-submit-target.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/app-doctor-submit-target.js')>()
  return {...actual, resolveDoctorSubmitClientId: vi.fn(actual.resolveDoctorSubmitClientId)}
})
vi.mock('../../../utilities/developer-platform-client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utilities/developer-platform-client.js')>()),
  defaultDeveloperPlatformClient: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  fetch: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  terminalSupportsPrompting: vi.fn(() => false),
  readStdinString: vi.fn(),
}))
// Exercise actual stdout/stderr instead of CLI-kit's unit-test log collector.
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isUnitTest: () => false,
  isDevelopment: () => true,
}))
// Command lifecycle telemetry is unrelated to submission. Keep the real error handler and renderer.
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()),
  reportAnalyticsEvent: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/session')>()),
  setCurrentSessionAlias: vi.fn(),
}))

const signedUploadUrl = 'https://storage.example.test/scan?secret=signed-upload-token'

function remoteClient() {
  const generateSourceScanUploadUrl = vi.fn(
    async (): Promise<SourceScanUploadUrlSchema> => ({sourceScanUploadUrl: signedUploadUrl, userErrors: []}),
  )
  const createSourceScan = vi.fn(async (): Promise<SourceScanCreateSchema> => ({accepted: true, userErrors: []}))
  const appFromIdentifiers = vi.fn<DeveloperPlatformClient['appFromIdentifiers']>(async () =>
    testOrganizationApp({developerPlatformClient: client}),
  )
  const accountInfo = vi.fn<DeveloperPlatformClient['accountInfo']>()
  const client = testDeveloperPlatformClient({
    appFromIdentifiers,
    accountInfo,
    generateSourceScanUploadUrl,
    createSourceScan,
  })
  vi.mocked(defaultDeveloperPlatformClient).mockReturnValue(client)
  vi.mocked(fetch).mockResolvedValue(new Response('', {status: 200}))
  return {appFromIdentifiers, accountInfo, generateSourceScanUploadUrl, createSourceScan}
}

async function writeApp(directory: string) {
  const paths = appDoctorArtifactPaths(directory)
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "configured-client-id"\n')
  await mkdir(paths.artifactDirectory, {recursive: true})
  await writeFile(paths.tracePath, JSON.stringify(submissionTraceFixture))
  return paths
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
  // Observe the real Oclif error handler's requested exit without terminating the test worker.
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    process.exitCode = code ?? 0
    return undefined as never
  })
  try {
    const config = await Config.load(import.meta.url)
    // This test invokes the app command directly, not as a separately installed CLI plugin.
    config.plugins.clear()
    await DoctorSubmit.run(argv, config)
    return {stdout, stderr, exitCode: process.exitCode, exits: exit.mock.calls.map(([code]) => code)}
  } finally {
    out.mockRestore()
    err.mockRestore()
    exit.mockRestore()
    process.exitCode = previousExitCode
  }
}

describe('app doctor submit command boundary', () => {
  test('rejects the removed source-control URL flag before doing any work', async () => {
    await inTemporaryDirectory(async (directory) => {
      remoteClient()
      const result = await runCommand([
        '--path',
        directory,
        '--dry-run',
        '--source-control-url',
        'https://github.com/example/app/tree/v1.2.3',
      ])

      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('Nonexistent flag: --source-control-url')
      expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      await expect(readdir(directory)).resolves.toEqual([])
    })
  })

  test.each([false, true])('dry-run uses real root, trace and artifact I/O (json=%s)', async (json) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      const paths = await writeApp(directory)
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "Unlinked app"\n')
      const result = await runCommand(['--path', directory, '--dry-run', ...(json ? ['--json'] : [])])

      expect(result.exitCode).toBe(0)
      expect(result.exits).toEqual([])
      if (json) {
        expect(JSON.parse(result.stdout)).toEqual({
          operation: 'submit',
          dry_run: true,
          payload: {path: paths.submissionPath, schema_version: 1},
        })
        expect(result.stderr).toBe('')
      } else {
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain('Prepared the App Doctor submission without uploading it.')
      }
      const submission = JSON.parse(await readFile(paths.submissionPath, 'utf8'))
      expect(submission.schemaVersion).toBe(1)
      expect(submission.report.metadata).toEqual({version_tag: null})
      expect(resolveDoctorSubmitClientId).not.toHaveBeenCalled()
      expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
      expect(client.appFromIdentifiers).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      await expect(readdir(joinPath(directory, '.shopify'))).resolves.toEqual(['app-doctor'])
    })
  })

  test.each([
    {flags: ['--config', 'staging'], clientId: undefined, configName: 'staging'},
    {flags: ['--client-id', 'explicit-client-id'], clientId: 'explicit-client-id', configName: undefined},
  ])('dry-run validates explicit selection $flags without network access', async ({flags, clientId, configName}) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      const paths = await writeApp(directory)
      await writeFile(joinPath(directory, 'shopify.app.staging.toml'), 'client_id = "staging-client-id"\n')

      const result = await runCommand(['--path', directory, '--dry-run', '--json', ...flags])

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        dry_run: true,
        payload: {path: paths.submissionPath, schema_version: 1},
      })
      expect(resolveDoctorSubmitClientId).toHaveBeenCalledExactlyOnceWith({directory, clientId, configName})
      await expect(readFile(paths.submissionPath, 'utf8')).resolves.toContain('"schemaVersion": 1')
      expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
      expect(client.appFromIdentifiers).not.toHaveBeenCalled()
      expect(client.generateSourceScanUploadUrl).not.toHaveBeenCalled()
      expect(client.createSourceScan).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe.each([false, true])('dry-run rejects invalid explicit config (json=%s)', (json) => {
    test.each([
      {content: undefined, message: "Couldn't find app configuration"},
      {content: 'client_id = [', message: "Couldn't read app configuration"},
      {content: 'name = "Unlinked app"', message: 'must contain a non-empty string client_id'},
      {content: 'client_id = " "', message: 'must contain a non-empty string client_id'},
    ])('rejects config content $content before writing or network access', async ({content, message}) => {
      await inTemporaryDirectory(async (directory) => {
        remoteClient()
        const paths = await writeApp(directory)
        if (content !== undefined) await writeFile(joinPath(directory, 'shopify.app.staging.toml'), content)

        const result = await runCommand([
          '--path',
          directory,
          '--dry-run',
          '--config',
          'staging',
          ...(json ? ['--json'] : []),
        ])

        expect(result.exitCode).toBe(1)
        if (json) {
          expect(JSON.parse(result.stdout)).toMatchObject({
            operation: 'submit',
            error: {stage: 'preparation', message: expect.stringContaining(message)},
          })
          expect(result.stderr).toBe('')
        } else {
          expect(result.stdout).toBe('')
          const messageText = unstyled(result.stderr).replaceAll('│', '').replace(/\s+/g, ' ')
          expect(messageText).toContain(message)
        }
        expect(resolveDoctorSubmitClientId).toHaveBeenCalledOnce()
        await expect(readFile(paths.submissionPath)).rejects.toMatchObject({code: 'ENOENT'})
        expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
        expect(fetch).not.toHaveBeenCalled()
      })
    })
  })

  test.each([false, true])('API rejection JSON preserves errors and accepted=%s', async (accepted) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      const userErrors = [
        {message: 'First rejection', field: ['sourceScanUrl']},
        {message: 'Second rejection', field: null},
      ]
      client.createSourceScan.mockResolvedValue({accepted, userErrors})
      const paths = await writeApp(directory)
      const result = await runCommand(['--path', directory, '--json', '--force', '--feedback', 'src/private.ts secret'])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).not.toContain(signedUploadUrl)
      expect(result.stderr).toBe('')
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        error: {
          stage: 'create',
          message: 'First rejection, Second rejection',
          user_errors: userErrors,
          accepted,
          try_message: 'Try submitting the App Doctor results again.',
        },
      })
      expect(client.appFromIdentifiers).toHaveBeenCalledWith('configured-client-id')
      const writtenBytes = await readFile(paths.submissionPath)
      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        signedUploadUrl,
        {
          method: 'put',
          body: writtenBytes,
          headers: {'Content-Type': 'application/json'},
        },
        'slow-request',
      )
      expect(JSON.parse(writtenBytes.toString()).report.feedback).toBe('src/private.ts secret')
      expect(client.generateSourceScanUploadUrl).toHaveBeenCalledWith({appId: '1', byteSize: writtenBytes.length})
      await expect(readdir(joinPath(directory, '.shopify'))).resolves.toEqual(['app-doctor'])
    })
  })

  test('upload URL rejection JSON retains user errors without exposing the signed URL', async () => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      const userErrors = [{message: 'Invalid app', field: ['appId']}]
      client.generateSourceScanUploadUrl.mockResolvedValue({sourceScanUploadUrl: signedUploadUrl, userErrors})
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--json', '--force'])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        error: {stage: 'upload-url', message: 'Invalid app', user_errors: userErrors},
      })
      expect(result.stdout).not.toContain(signedUploadUrl)
      expect(result.stderr).toBe('')
      expect(fetch).not.toHaveBeenCalled()
      expect(client.createSourceScan).not.toHaveBeenCalled()
    })
  })

  test('successful submission JSON identifies the receiving app without changing the uploaded report', async () => {
    await inTemporaryDirectory(async (directory) => {
      remoteClient()
      const paths = await writeApp(directory)
      const result = await runCommand(['--path', directory, '--json', '--force'])
      const submission = JSON.parse(await readFile(paths.submissionPath, 'utf8'))
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        dry_run: false,
        payload: {path: paths.submissionPath, schema_version: 1},
        submitted_at: submission.report.submitted_at,
        client_id: 'api-key',
      })
      expect(submission).not.toHaveProperty('client_id')
      expect(submission.report).not.toHaveProperty('client_id')
      expect(result.stderr).toBe('')
      expect(result.exitCode).toBe(0)
    })
  })

  test.each([false, true])('missing app root is an expected error, not a CLI defect (json=%s)', async (json) => {
    await inTemporaryDirectory(async (directory) => {
      remoteClient()
      const result = await runCommand(['--path', directory, '--force', ...(json ? ['--json'] : [])])

      expect(result.exitCode).toBe(1)
      if (json) {
        expect(JSON.parse(result.stdout)).toEqual({
          operation: 'submit',
          error: {
            stage: 'preparation',
            message: `Could not find a shopify.app*.toml from: ${directory}`,
            try_message: 'Run this command from a Shopify app directory or pass --path to one.',
          },
        })
        expect(result.stderr).toBe('')
      } else {
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain('Could not find a shopify.app*.toml')
        expect(result.stderr).toContain('Run this command from a Shopify app directory')
        expect(result.exits).toEqual([1])
        expect(result.stderr).not.toContain('To investigate the issue, examine this stack trace:')
      }
      expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      await expect(readdir(directory)).resolves.toEqual([])
    })
  })

  test.each([undefined, 'missing'])(
    'unresolvable submission target retains JSON recovery guidance (config=%s)',
    async (configName) => {
      await inTemporaryDirectory(async (directory) => {
        const client = remoteClient()
        const paths = await writeApp(directory)
        if (configName === undefined)
          await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "unlinked-app"\n')
        const configPath = joinPath(directory, configName ? `shopify.app.${configName}.toml` : 'shopify.app.toml')
        const result = await runCommand([
          '--path',
          directory,
          '--json',
          '--force',
          ...(configName ? ['--config', configName] : []),
        ])

        expect(result.exitCode).toBe(1)
        expect(result.stderr).toBe('')
        expect(JSON.parse(result.stdout)).toEqual({
          operation: 'submit',
          error: {
            stage: 'preparation',
            message: configName
              ? `Couldn't find app configuration at ${configPath}.`
              : `App configuration at ${configPath} must contain a non-empty string client_id.`,
            next_steps: [
              configName
                ? 'Pass `--config <name>` to select an existing app configuration, or `--client-id <client-id>` to select the app directly.'
                : 'Pass `--client-id <client-id>` to select the app directly, or run `shopify app config link` to link the app configuration.',
            ],
          },
        })
        expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
        expect(client.appFromIdentifiers).not.toHaveBeenCalled()
        expect(fetch).not.toHaveBeenCalled()
        await expect(readdir(paths.artifactDirectory)).resolves.toEqual(['trace.json'])
      })
    },
  )

  test.each(['named', 'cached'] as const)('malformed %s config retains path and help', async (selection) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      const paths = await writeApp(directory)
      const configPath = joinPath(directory, 'shopify.app.production.toml')
      const configContent = 'client_id = "production-client-id"\ninvalid = ['
      await writeFile(configPath, configContent)
      const parserError = await TomlFile.read(configPath).catch((error: unknown) => error)
      if (selection === 'cached') setCachedAppInfo({directory, configFile: 'shopify.app.production.toml'})
      try {
        const result = await runCommand([
          '--path',
          directory,
          '--json',
          '--force',
          ...(selection === 'named' ? ['--config', 'production'] : []),
        ])

        expect(result.exitCode).toBe(1)
        expect(result.stderr).toBe('')
        expect(parserError).toBeInstanceOf(AbortError)
        expect(JSON.parse(result.stdout)).toEqual({
          operation: 'submit',
          error: {
            stage: 'preparation',
            message: `Couldn't read app configuration at ${configPath}: ${(parserError as AbortError).message}`,
            next_steps: [expect.stringMatching(/--config.*--client-id/)],
          },
        })
        expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
        expect(client.appFromIdentifiers).not.toHaveBeenCalled()
        expect(client.generateSourceScanUploadUrl).not.toHaveBeenCalled()
        expect(client.createSourceScan).not.toHaveBeenCalled()
        expect(fetch).not.toHaveBeenCalled()
        await expect(readdir(paths.artifactDirectory)).resolves.toEqual(['trace.json'])
        await expect(readFile(configPath, 'utf8')).resolves.toBe(configContent)
      } finally {
        if (selection === 'cached') clearCachedAppInfo(directory)
      }
    })
  })

  test.each([false, true])('missing or inaccessible app has submit-specific help (json=%s)', async (json) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      client.appFromIdentifiers.mockResolvedValue(undefined)
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force', ...(json ? ['--json'] : [])])

      expect(result.exitCode).toBe(1)
      if (json) {
        expect(result.stderr).toBe('')
        expect(JSON.parse(result.stdout)).toEqual({
          operation: 'submit',
          error: {
            stage: 'preparation',
            message: "Couldn't find an app with the selected client ID, or you don't have access to it.",
            next_steps: [
              'Check `--client-id <client-id>` or `--config <name>` to select the intended app.',
              'Run `shopify auth login` with an account that has permission to access the app.',
            ],
          },
        })
      } else {
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain("Couldn't find an app with the selected client ID")
        expect(result.stderr).toContain('--client-id')
        expect(result.stderr).toContain('--config')
        expect(result.stderr).toContain('shopify auth login')
        expect(result.stderr).toContain('permission')
        expect(result.exits).toEqual([1])
        expect(result.stderr).not.toContain('To investigate the issue, examine this stack trace:')
      }
      expect(result.stdout + result.stderr).not.toContain('--reset')
      expect(result.stdout + result.stderr).not.toContain('create an app')
      expect(client.appFromIdentifiers).toHaveBeenCalledExactlyOnceWith('configured-client-id')
      expect(client.accountInfo).not.toHaveBeenCalled()
      expect(client.generateSourceScanUploadUrl).not.toHaveBeenCalled()
      expect(client.createSourceScan).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  test.each([false, true])('JSON missing force fails before target, network, stdin or write (TTY=%s)', async (tty) => {
    await inTemporaryDirectory(async (directory) => {
      remoteClient()
      vi.mocked(terminalSupportsPrompting).mockReturnValue(tty)
      // Even target and trace validation would fail; the force guard must win first.
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'invalid toml')
      const result = await runCommand(['--path', directory, '--json', '--config', 'missing', '--feedback', '-'])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        error: {stage: 'preparation', message: 'Pass --force to submit without confirmation.'},
      })
      expect(result.stderr).toBe('')
      expect(result.exits).toEqual([])
      expect(resolveDoctorSubmitClientId).not.toHaveBeenCalled()
      expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      expect(readStdinString).not.toHaveBeenCalled()
      await expect(readdir(directory)).resolves.toEqual(['shopify.app.toml'])
    })
  })

  test('a --json token in place of a required feedback value does not bypass parsing', async () => {
    await inTemporaryDirectory(async (directory) => {
      remoteClient()
      const result = await runCommand(['--path', directory, '--force', '--feedback', '--json'])
      expect(result.stderr).toContain('Flag --feedback expects a value')
      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).not.toContain('To investigate the issue, examine this stack trace:')
      expect(defaultDeveloperPlatformClient).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      await expect(readdir(directory)).resolves.toEqual([])
    })
  })

  test('API failure uses the real expected human error handler and retry help', async () => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      client.createSourceScan.mockResolvedValue({accepted: false, userErrors: []})
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force'])
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('Shopify did not accept the App Doctor submission.')
      expect(result.stderr).toContain('Try submitting the App Doctor results again.')
      expect(result.stderr).not.toContain('To investigate the issue, examine this stack trace:')
    })
  })

  test('unknown API exceptions remain CLI defects even in JSON mode', async () => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      client.createSourceScan.mockRejectedValue(new Error('Unexpected programming defect'))
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force', '--json'])
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('Unexpected programming defect')
      expect(result.stderr).toContain('To investigate the issue, examine this stack trace:')
    })
  })

  test.each(['ECONNRESET', 'ENOTFOUND'])('real uploader FetchError (%s) produces safe JSON', async (code) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      vi.mocked(fetch).mockRejectedValue(new FetchError(`request to ${signedUploadUrl} failed`, 'system', {code}))
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force', '--json'])

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        error: {
          stage: 'upload',
          message: 'A network error interrupted the App Doctor submission.',
          try_message: 'Check your network connection and try submitting the App Doctor results again.',
        },
      })
      expect(result.stdout).not.toContain(signedUploadUrl)
      expect(result.stdout).not.toContain('signed-upload-token')
      expect(result.stderr).toBe('')
      expect(fetch).toHaveBeenCalledOnce()
      expect(client.createSourceScan).not.toHaveBeenCalled()
    })
  })

  test.each(['preparation', 'upload'] as const)('human FetchError at %s is expected', async (stage) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      const failingCall = stage === 'preparation' ? client.appFromIdentifiers : vi.mocked(fetch)
      failingCall.mockRejectedValue(
        new FetchError(`request to ${signedUploadUrl} failed`, 'system', {code: 'ECONNRESET'}),
      )
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force'])

      expect(result.exitCode).toBe(1)
      expect(result.exits).toEqual([1])
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('A network error interrupted the App Doctor submission.')
      expect(result.stderr).toContain('Check your network connection')
      expect(result.stderr).toContain('try submitting')
      expect(result.stderr).not.toContain('signed-upload-token')
      expect(result.stderr).not.toContain('To investigate the issue, examine this stack trace:')
      expect(client.createSourceScan).not.toHaveBeenCalled()
    })
  })

  test('real uploader HTTP 403 becomes an expected JSON error without creating a scan', async () => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      vi.mocked(fetch).mockResolvedValue(new Response('Access denied', {status: 403}))
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force', '--json'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBe('')
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        error: {
          stage: 'upload',
          message: 'Failed to upload your App Doctor submission to storage (HTTP 403).',
          try_message: 'This is usually transient. Please try again, and check your network connection if it persists.',
          next_steps: ['Storage responded with: Access denied'],
        },
      })
      expect(fetch).toHaveBeenCalledOnce()
      expect(client.createSourceScan).not.toHaveBeenCalled()
    })
  })

  test.each([
    {
      error: new AbortError('Authentication failed', 'Log in again.', ['Run `shopify auth login`.']),
      expected: {
        message: 'Authentication failed',
        try_message: 'Log in again.',
        next_steps: ['Run `shopify auth login`.'],
      },
    },
    {
      error: new FetchError(`request to ${signedUploadUrl} failed`, 'system', {code: 'ENOTFOUND'}),
      expected: {
        message: 'A network error interrupted the App Doctor submission.',
        try_message: 'Check your network connection and try submitting the App Doctor results again.',
      },
    },
  ])('app lookup failure retains preparation JSON and help ($error.name)', async ({error, expected}) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      client.appFromIdentifiers.mockRejectedValue(error)
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force', '--json'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBe('')
      expect(JSON.parse(result.stdout)).toEqual({operation: 'submit', error: {stage: 'preparation', ...expected}})
      expect(result.stdout).not.toContain('signed-upload-token')
      expect(client.appFromIdentifiers).toHaveBeenCalledExactlyOnceWith('configured-client-id')
      expect(client.accountInfo).not.toHaveBeenCalled()
      expect(client.generateSourceScanUploadUrl).not.toHaveBeenCalled()
      expect(client.createSourceScan).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  test.each([new Error('Lookup defect'), new TypeError('Lookup type')])('lookup %s stays a defect', async (error) => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      client.appFromIdentifiers.mockRejectedValue(error)
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force', '--json'])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(error.message)
      expect(result.stderr).toContain('To investigate the issue, examine this stack trace:')
      expect(client.generateSourceScanUploadUrl).not.toHaveBeenCalled()
      expect(client.createSourceScan).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  test('expected upload failures become JSON without reaching create', async () => {
    await inTemporaryDirectory(async (directory) => {
      const client = remoteClient()
      vi.mocked(fetch).mockRejectedValue(new AbortError('Network unavailable'))
      await writeApp(directory)
      const result = await runCommand(['--path', directory, '--force', '--json'])
      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({
        operation: 'submit',
        error: {stage: 'upload', message: 'Network unavailable'},
      })
      expect(result.stderr).toBe('')
      expect(client.createSourceScan).not.toHaveBeenCalled()
    })
  })
})
