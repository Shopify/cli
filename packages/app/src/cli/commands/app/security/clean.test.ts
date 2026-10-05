import SecurityClean from './clean.js'
import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {resolveAppDirectory, resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import securityClean, {renderSecurityCleanResult} from '../../../services/security-clean.js'
import {securityCleanJsonOutputSchema} from '../../../services/security-clean-json.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import type {SecurityCleanResult} from '../../../services/security-clean-json.js'

vi.mock('../../../services/security-clean.js')
vi.mock('../../../services/app-security-selection.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/app-security-selection.js')>()),
  resolveAppSecuritySelection: vi.fn(),
  resolveAppDirectory: vi.fn(),
}))

/**
 * Creates an app directory and makes the resolvers find it, as the real ones would. The results
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
  vi.mocked(resolveAppDirectory).mockResolvedValue(appDirectory)
  return appDirectory
}

/** Runs the command expecting it to fail, and returns what it printed to stderr. */
async function runRejected(argv: string[]): Promise<string> {
  const output = mockAndCaptureOutput()
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await expect(SecurityClean.run(argv, import.meta.url)).rejects.toThrow('process.exit unexpectedly called with "1"')
    return output.error()
  } finally {
    consoleErrorSpy.mockRestore()
    output.clear()
  }
}

function cleanedResult(appDirectory: string): SecurityCleanResult {
  return {removed: [appSecurityArtifactPaths(appDirectory, 'shopify.app').resultsDirectory]}
}

describe('app security clean command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(SecurityClean.hidden).toBe(true)
    expect(SecurityClean.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityClean.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityClean.flags).toHaveProperty('json')
    expect(SecurityClean.jsonOutputSchema).toBe(securityCleanJsonOutputSchema)
  })

  test('defines the selection flags as check does, except --without-app-config', () => {
    expect(SecurityClean.flags.path).toBe(appFlags.path)
    expect(SecurityClean.flags.config).toBe(appFlags.config)
    expect(SecurityClean.flags['client-id']).toBe(appFlags['client-id'])
    const cleanFlag = SecurityClean.flags['without-app-config']
    const checkFlag = SecurityCheck.flags['without-app-config']
    expect(cleanFlag).toMatchObject({description: checkFlag.description, env: checkFlag.env, exclusive: ['config']})
    expect(checkFlag).toMatchObject({dependsOn: ['client-id']})
    expect(cleanFlag.dependsOn).toBeUndefined()
    expect(cleanFlag.relationships).toHaveLength(1)
  })

  test('defines --all without an environment variable, exclusive with --config and --client-id', () => {
    expect(SecurityClean.flags.all).toMatchObject({exclusive: ['config', 'client-id']})
    expect(SecurityClean.flags.all.env).toBeUndefined()
  })

  test('cleans the results of the app in the current directory by default and presents the result', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      const result = cleanedResult(appDirectory)
      vi.mocked(securityClean).mockResolvedValue(result)
      vi.stubEnv('INIT_CWD', directory)
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityClean.run([], import.meta.url)

        expect(resolveAppSecuritySelection).toHaveBeenCalledWith({
          path: cwd(),
          config: undefined,
          clientId: undefined,
          withoutAppConfig: undefined,
          allowPrompts: false,
        })
        expect(securityClean).toHaveBeenCalledWith({
          all: false,
          selection: await vi.mocked(resolveAppSecuritySelection).mock.results[0]!.value,
        })
        expect(resolveAppDirectory).not.toHaveBeenCalled()
        expect(renderSecurityCleanResult).toHaveBeenCalledWith(result, appDirectory)
        expect(output.info()).toBe('')
      } finally {
        vi.unstubAllEnvs()
        output.clear()
      }
    })
  })

  test('forwards --path, --config and --client-id without prompting, and prints exactly the encoded result with --json', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)
      await mkdir(appSecurityArtifactPaths(appDirectory, 'other-client-id').resultsDirectory)
      const result = cleanedResult(appDirectory)
      vi.mocked(securityClean).mockResolvedValue(result)
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityClean.run(['--path', directory, '--client-id', 'other-client-id', '--json'], import.meta.url)

        expect(resolveAppSecuritySelection).toHaveBeenCalledWith({
          path: directory,
          config: undefined,
          clientId: 'other-client-id',
          withoutAppConfig: undefined,
          allowPrompts: false,
        })
        expect(output.info()).toBe(
          ['{', '  "removed": [', `    ${JSON.stringify(result.removed[0])}`, '  ]', '}'].join('\n'),
        )
        expect(renderSecurityCleanResult).not.toHaveBeenCalled()
      } finally {
        output.clear()
      }
    })
  })

  test('aborts with "No results found" and removes nothing when the results directory does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory, {withResults: false})

      const printed = await runRejected(['--path', directory])

      expect(printed).toContain('No app security check results for shopify.app in')
      expect(printed).toContain('shopify app security check')
      expect(securityClean).not.toHaveBeenCalled()
    })
  })

  test('--all removes every results directory of the app, without needing a results directory for a key', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {withResults: false})
      const result = cleanedResult(appDirectory)
      vi.mocked(securityClean).mockResolvedValue(result)
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityClean.run(['--path', directory, '--all'], import.meta.url)

        expect(resolveAppDirectory).toHaveBeenCalledWith({
          path: directory,
          config: undefined,
          clientId: undefined,
          withoutAppConfig: undefined,
        })
        expect(resolveAppSecuritySelection).not.toHaveBeenCalled()
        expect(securityClean).toHaveBeenCalledWith({all: true, appDirectory})
        expect(renderSecurityCleanResult).toHaveBeenCalledWith(result, appDirectory)
      } finally {
        output.clear()
      }
    })
  })

  test('--all with --without-app-config needs no --client-id', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {withResults: false})
      vi.mocked(securityClean).mockResolvedValue({removed: []})
      const output = mockAndCaptureOutput()
      output.clear()

      try {
        await SecurityClean.run(['--path', directory, '--all', '--without-app-config'], import.meta.url)

        expect(resolveAppDirectory).toHaveBeenCalledWith(expect.objectContaining({withoutAppConfig: true}))
        expect(securityClean).toHaveBeenCalledWith({all: true, appDirectory})
      } finally {
        output.clear()
      }
    })
  })

  test('--without-app-config requires --client-id unless --all is passed', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      const printed = await runRejected(['--path', directory, '--without-app-config'])

      expect(printed).toContain('client-id')
      expect(securityClean).not.toHaveBeenCalled()
    })
  })

  test.each([
    ['--config', 'staging'],
    ['--client-id', 'client-id-1'],
  ])('--all cannot be combined with %s', async (flag, value) => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      const printed = await runRejected(['--path', directory, '--all', flag, value])

      expect(printed).toContain('cannot also be provided')
      expect(securityClean).not.toHaveBeenCalled()
    })
  })
})
