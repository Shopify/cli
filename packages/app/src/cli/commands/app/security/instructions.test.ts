import SecurityInstructions from './instructions.js'
import SecurityCheck from './check.js'
import {appFlags} from '../../../flags.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {resolveAppSecurityCommands} from '../../../services/app-security-commands.js'
import deliverAppSecurityInstructions from '../../../services/app-security-instructions.js'
import {resolveAppSecuritySelection, type AppSecuritySelection} from '../../../services/app-security-selection.js'
import {validAppConfiguration} from '../../../services/app-security-selection.test-data.js'
import AppLinkedCommand from '../../../utilities/app-linked-command.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-security-instructions.js')
vi.mock('../../../services/app-security-selection.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/app-security-selection.js')>()),
  resolveAppSecuritySelection: vi.fn(),
}))

/**
 * Makes the selection resolver find an app directory with the given configuration file, as the real resolver
 * would, and creates the results directory for `resultsKey` unless it is null.
 */
async function createApp(
  directory: string,
  {
    configFileName = 'shopify.app.toml',
    resultsKey = 'shopify.app',
  }: {configFileName?: string; resultsKey?: string | null} = {},
): Promise<string> {
  const appDirectory = await fileRealPath(directory)
  if (resultsKey) await mkdir(appSecurityArtifactPaths(appDirectory, resultsKey).resultsDirectory)
  vi.mocked(resolveAppSecuritySelection).mockResolvedValue({
    kind: 'config',
    appDirectory,
    appConfigFilePath: joinPath(appDirectory, configFileName),
  })
  return appDirectory
}

/** Makes the mocked resolver run the real one, with a client ID lookup that fails for every client ID. */
async function resolveWithFailingLookUp() {
  const actual = await vi.importActual<typeof import('../../../services/app-security-selection.js')>(
    '../../../services/app-security-selection.js',
  )
  const lookUpApp = vi.fn(async (clientId: string) => {
    throw new AbortError(`No app with client ID ${clientId} found`)
  })
  vi.mocked(resolveAppSecuritySelection).mockImplementation((options) =>
    actual.resolveAppSecuritySelection(options, {
      confirmScanWithoutAppConfig: async () => true,
      pickClientId: async () => 'picked-client-id',
      pickConfigFile: async () => 'shopify.app.toml',
      lookUpApp,
    }),
  )
  return lookUpApp
}

function configSelection(appDirectory: string, configFileName: string): AppSecuritySelection {
  return {kind: 'config', appDirectory, appConfigFilePath: joinPath(appDirectory, configFileName)}
}

describe('app security instructions command', () => {
  test('is hidden and does not require linked app context', () => {
    expect(SecurityInstructions.hidden).toBe(true)
    expect(SecurityInstructions.prototype).toBeInstanceOf(BaseCommand)
    expect(SecurityInstructions.prototype).not.toBeInstanceOf(AppLinkedCommand)
    expect(SecurityInstructions.args).not.toHaveProperty('directory')
  })

  test('defines the selection flags as check does', () => {
    expect(SecurityInstructions.flags.path).toBe(appFlags.path)
    expect(SecurityInstructions.flags.config).toBe(appFlags.config)
    expect(SecurityInstructions.flags['client-id']).toBe(appFlags['client-id'])
    expect(SecurityInstructions.flags['without-app-config']).toBe(SecurityCheck.flags['without-app-config'])
  })

  test('prints instructions for the current directory by default', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory)

      await SecurityInstructions.run([], import.meta.url)

      expect(resolveAppSecuritySelection).toHaveBeenCalledWith({
        path: cwd(),
        config: undefined,
        clientId: undefined,
        withoutAppConfig: undefined,
        allowPrompts: false,
      })
      expect(deliverAppSecurityInstructions).toHaveBeenCalledWith({
        appDirectory,
        resultsKey: 'shopify.app',
        commands: resolveAppSecurityCommands(configSelection(appDirectory, 'shopify.app.toml'), cwd()),
        copy: false,
        writePath: undefined,
      })
    })
  })

  test('forwards --path and --copy', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      await SecurityInstructions.run(['--path', './fixtures/unlinked-app', '--copy'], import.meta.url)

      expect(resolveAppSecuritySelection).toHaveBeenCalledWith(
        expect.objectContaining({path: resolvePath('./fixtures/unlinked-app')}),
      )
      expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(expect.objectContaining({copy: true}))
    })
  })

  test('resolves and forwards --write', async () => {
    await inTemporaryDirectory(async (directory) => {
      await createApp(directory)

      await SecurityInstructions.run(['--write', './instructions.md'], import.meta.url)

      expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(
        expect.objectContaining({copy: false, writePath: resolvePath('./instructions.md')}),
      )
    })
  })

  test('selects the configuration named by --config and puts it in the commands and the results key', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {
        configFileName: 'shopify.app.staging.toml',
        resultsKey: 'shopify.app.staging',
      })

      await SecurityInstructions.run(['--path', './fixtures/unlinked-app', '--config', 'staging'], import.meta.url)

      expect(resolveAppSecuritySelection).toHaveBeenCalledWith(expect.objectContaining({config: 'staging'}))
      expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(
        expect.objectContaining({
          resultsKey: 'shopify.app.staging',
          commands: resolveAppSecurityCommands(
            configSelection(appDirectory, 'shopify.app.staging.toml'),
            resolvePath('./fixtures/unlinked-app'),
          ),
        }),
      )
    })
  })

  test('forwards --client-id and --without-app-config to the resolver and uses the client ID as the results key', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await fileRealPath(directory)
      vi.mocked(resolveAppSecuritySelection).mockResolvedValue({
        kind: 'no-config',
        appDirectory,
        clientId: 'abc123',
        clientIdSource: 'flag',
      })

      await SecurityInstructions.run(['--without-app-config', '--client-id', 'abc123'], import.meta.url)

      expect(resolveAppSecuritySelection).toHaveBeenCalledWith(
        expect.objectContaining({clientId: 'abc123', withoutAppConfig: true, allowPrompts: false}),
      )
      expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(expect.objectContaining({resultsKey: 'abc123'}))
    })
  })

  test('delivers instructions when the results directory does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await createApp(directory, {resultsKey: null})

      await SecurityInstructions.run([], import.meta.url)

      expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(
        expect.objectContaining({appDirectory, resultsKey: 'shopify.app'}),
      )
    })
  })

  test('keeps --copy and --write mutually exclusive', () => {
    expect(SecurityInstructions.flags.copy.exclusive).toEqual(['write'])
    expect(SecurityInstructions.flags.write.exclusive).toEqual(['copy'])
  })

  test('does not look up --client-id', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = await fileRealPath(directory)
      await writeFile(joinPath(appDirectory, 'shopify.app.toml'), validAppConfiguration('toml-client-id'))
      const lookUpApp = await resolveWithFailingLookUp()

      await SecurityInstructions.run(['--path', directory, '--client-id', 'mistyped-client-id'], import.meta.url)

      expect(lookUpApp).not.toHaveBeenCalled()
      expect(deliverAppSecurityInstructions).toHaveBeenCalledWith(
        expect.objectContaining({resultsKey: 'mistyped-client-id'}),
      )
    })
  })
})
