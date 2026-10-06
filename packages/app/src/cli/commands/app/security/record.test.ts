import SecurityRecord from './record.js'
import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import securityRecord, {renderSecurityRecordResult} from '../../../services/security-record.js'
import {securityRecordJsonOutputSchema} from '../../../services/security-record-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/security-record.js')
vi.mock('../../../services/app-security-selection.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/app-security-selection.js')>()),
  resolveAppSecuritySelection: vi.fn(),
}))

/**
 * Creates an app directory and makes the selection resolver find it, as the real resolver would. The results
 * directory of its `shopify.app` results key exists only when `withResults` is set.
 */
async function createApp(directory: string, {withResults = true} = {}): Promise<string> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const appDirectory = await fileRealPath(directory)
  if (withResults) await mkdir(appSecurityArtifactPaths(appDirectory, 'shopify.app').resultsDirectory)
  vi.mocked(resolveAppSecuritySelection).mockResolvedValue({
    kind: 'config',
    appDirectory,
    appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml'),
  })
  return appDirectory
}

/**
 * Creates an app that the real resolver loads, with a results directory for `resultsKey`, and makes the mocked
 * resolver run the real one with the client ID lookup replaced.
 */
async function createLinkedApp(
  directory: string,
  resultsKey: string,
  lookUpApp: (clientId: string) => Promise<void>,
): Promise<string> {
  const appDirectory = await fileRealPath(directory)
  await writeFile(joinPath(appDirectory, 'shopify.app.toml'), validAppConfiguration('toml-client-id'))
  await mkdir(appSecurityArtifactPaths(appDirectory, resultsKey).resultsDirectory)
  const actual = await vi.importActual<typeof import('../../../services/app-security-selection.js')>(
    '../../../services/app-security-selection.js',
  )
  vi.mocked(resolveAppSecuritySelection).mockImplementation((options) =>
    actual.resolveAppSecuritySelection(options, {
      confirmScanWithoutAppConfig: async () => true,
      pickClientId: async () => 'picked-client-id',
      pickConfigFile: async () => 'shopify.app.toml',
      lookUpApp,
    }),
  )
  return appDirectory
}

function recordedResult(appRoot: string) {
  return {path: appSecurityArtifactPaths(appRoot, 'shopify.app').agentFindingsPath, checks: 2, findings: 3}
}

describe('app security record command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(SecurityRecord.hidden).toBe(true)
    expect(SecurityRecord.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityRecord.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityRecord.flags).toHaveProperty('json')
    expect(SecurityRecord.jsonOutputSchema).toBe(securityRecordJsonOutputSchema)
  })

  test('defines the selection flags as check does', () => {
    expect(SecurityRecord.flags.path).toBe(appFlags.path)
    expect(SecurityRecord.flags.config).toBe(appFlags.config)
    expect(SecurityRecord.flags['client-id']).toBe(appFlags['client-id'])
    expect(SecurityRecord.flags['without-app-config']).toBe(SecurityCheck.flags['without-app-config'])
  })

  test('records for the app in the current directory by default and presents the result', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const result = recordedResult(appRoot)
      vi.mocked(securityRecord).mockResolvedValue(result)
      vi.stubEnv('INIT_CWD', directory)
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityRecord.run([], import.meta.url)

        expect(resolveAppSecuritySelection).toHaveBeenCalledWith({
          path: cwd(),
          config: undefined,
          clientId: undefined,
          withoutAppConfig: undefined,
          allowPrompts: false,
          validateClientIdFlag: true,
        })
        const selection = await vi.mocked(resolveAppSecuritySelection).mock.results[0]!.value
        expect(securityRecord).toHaveBeenCalledWith({selection, path: cwd()})
        expect(renderSecurityRecordResult).toHaveBeenCalledWith(result, selection, cwd())
        expect(output.info()).toBe('')
      } finally {
        vi.unstubAllEnvs()
        output.clear()
      }
    })
  })

  test('prints exactly the encoded result with --json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      vi.mocked(securityRecord).mockResolvedValue(recordedResult(appRoot))
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityRecord.run(['--path', directory, '--json'], import.meta.url)

        expect(resolveAppSecuritySelection).toHaveBeenCalledWith(expect.objectContaining({path: directory}))
        expect(securityRecord).toHaveBeenCalledWith({
          selection: await vi.mocked(resolveAppSecuritySelection).mock.results[0]!.value,
          path: directory,
        })
        expect(output.info()).toBe(
          [
            '{',
            `  "path": ${JSON.stringify(recordedResult(appRoot).path)},`,
            '  "checks": 2,',
            '  "findings": 3',
            '}',
          ].join('\n'),
        )
        expect(renderSecurityRecordResult).not.toHaveBeenCalled()
      } finally {
        output.clear()
      }
    })
  })

  test('forwards --config, --client-id and --without-app-config to the resolver without prompting', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      await mkdir(appSecurityArtifactPaths(appRoot, 'abc123').resultsDirectory)
      vi.mocked(securityRecord).mockResolvedValue(recordedResult(appRoot))
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityRecord.run(
          ['--path', directory, '--without-app-config', '--client-id', 'abc123', '--json'],
          import.meta.url,
        )

        expect(resolveAppSecuritySelection).toHaveBeenCalledWith({
          path: directory,
          config: undefined,
          clientId: 'abc123',
          withoutAppConfig: true,
          allowPrompts: false,
          validateClientIdFlag: true,
        })
      } finally {
        output.clear()
      }
    })
  })

  test('aborts with "No results found" before reading stdin when the results directory does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {withResults: false})
      const output = mockAndCaptureOutput()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await expect(SecurityRecord.run(['--path', directory], import.meta.url)).rejects.toThrow(
          'process.exit unexpectedly called with "1"',
        )

        expect(output.error()).toContain('No app security check results for shopify.app in')
        expect(output.error()).toContain('shopify app security check')
        expect(securityRecord).not.toHaveBeenCalled()
      } finally {
        consoleErrorSpy.mockRestore()
        output.clear()
      }
    })
  })

  test('looks up --client-id and records when it is found', async () => {
    await inTemporaryDirectory(async (directory) => {
      const lookUpApp = vi.fn(async (_clientId: string) => {})
      const appRoot = await createLinkedApp(directory, 'flag-client-id', lookUpApp)
      vi.mocked(securityRecord).mockResolvedValue(recordedResult(appRoot))
      const output = mockAndCaptureOutput()

      try {
        await SecurityRecord.run(['--path', directory, '--client-id', 'flag-client-id', '--json'], import.meta.url)

        expect(lookUpApp).toHaveBeenCalledWith('flag-client-id')
        expect(securityRecord).toHaveBeenCalledWith({
          selection: expect.objectContaining({clientIdOverride: 'flag-client-id'}),
          path: directory,
        })
      } finally {
        output.clear()
      }
    })
  })

  test('aborts on an unknown --client-id before reading stdin or writing anything', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createLinkedApp(directory, 'unknown-client-id', async () => {
        throw new AbortError('No app with client ID unknown-client-id found')
      })
      const output = mockAndCaptureOutput()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await expect(
          SecurityRecord.run(['--path', directory, '--client-id', 'unknown-client-id'], import.meta.url),
        ).rejects.toThrow('process.exit unexpectedly called with "1"')

        expect(output.error()).toContain('No app with client ID unknown-client-id found')
        expect(securityRecord).not.toHaveBeenCalled()
        await expect(
          fileExists(appSecurityArtifactPaths(appRoot, 'unknown-client-id').agentFindingsPath),
        ).resolves.toBe(false)
      } finally {
        consoleErrorSpy.mockRestore()
        output.clear()
      }
    })
  })

  test('does not look up the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      const lookUpApp = vi.fn(async (_clientId: string) => {})
      const appRoot = await createLinkedApp(directory, 'shopify.app', lookUpApp)
      vi.mocked(securityRecord).mockResolvedValue(recordedResult(appRoot))
      const output = mockAndCaptureOutput()

      try {
        await SecurityRecord.run(['--path', directory, '--json'], import.meta.url)

        expect(lookUpApp).not.toHaveBeenCalled()
        expect(securityRecord).toHaveBeenCalled()
      } finally {
        output.clear()
      }
    })
  })
})
