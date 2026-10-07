import ImportDashboardExtensions from './dashboard-extensions.js'
import {linkedAppContext} from '../../../services/app-context.js'
import * as extensionImportService from '../../../services/import-extensions.js'
import {importDashboardExtensionsJsonOutputSchema} from '../../../services/import-extensions/types.js'
import {testAppLinked, testOrganizationApp, testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {ExtensionRegistration} from '../../../api/graphql/all_app_extension_registrations.js'
import {Config, Errors} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {errorHandler, sendErrorToBugsnag} from '@shopify/cli-kit/node/error-handler'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/error-handler', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/error-handler')>()),
  sendErrorToBugsnag: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderSelectPrompt: vi.fn(),
}))

const extension: ExtensionRegistration = {
  id: 'gid://shopify/AppExtensionRegistration/1',
  uuid: 'e7282f2d-3017-4608-a9a4-54dd5a7a70aa',
  title: 'Example action',
  type: 'flow_action_definition',
  activeVersion: {config: '{"title":"Example action","description":"A description","url":"https://example.com/run"}'},
}

async function withApp(run: (app: ReturnType<typeof testAppLinked>) => Promise<void>, extensions = [extension]) {
  await inTemporaryDirectory(async (directory) => {
    const configPath = joinPath(directory, 'shopify.app.toml')
    await writeFile(configPath, 'name = "Test app"\nclient_id = "test-client-id"\n')
    const app = testAppLinked({directory, configPath})
    const developerPlatformClient = testDeveloperPlatformClient()
    vi.spyOn(developerPlatformClient, 'appExtensionRegistrations').mockImplementation(async () => {
      outputInfo('Loaded dashboard extensions')
      return {
        app: {
          extensionRegistrations: [],
          dashboardManagedExtensionRegistrations: extensions,
          configurationRegistrations: [],
        },
      }
    })
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      remoteApp: testOrganizationApp({apiKey: 'test-client-id'}),
      developerPlatformClient,
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(renderSelectPrompt).mockReset().mockResolvedValue(extension.uuid)
    await run(app)
  })
}

function publicExtension(directory: string) {
  const extensionDirectory = joinPath(directory, 'extensions', 'example-action')
  return {
    id: extension.uuid,
    name: extension.title,
    type: extension.type,
    directory: extensionDirectory,
    configurationPath: joinPath(extensionDirectory, 'shopify.extension.toml'),
    changed: true,
  }
}

async function runCommand(directory: string) {
  const args = ['--path', directory, '--json']
  const command = new ImportDashboardExtensions(args, await Config.load())
  return runWithCommandEventsForCommand(args, () => command.run())
}

test('writes JSON after saving identifiers and sends diagnostics to stderr', async () => {
  await withApp(async (app) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(app.directory)
      const result = JSON.parse(stdout())
      expect(result).toEqual({
        status: 'success',
        reason: null,
        extensions: [publicExtension(app.directory)],
        errors: [],
        identifiersUpdated: true,
      })
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Loaded dashboard extensions'})
      expect(() => importDashboardExtensionsJsonOutputSchema.encode({...result, internal: true})).toThrow()
    })
    await expect(readFile(joinPath(app.directory, '.env'))).resolves.toContain(
      `SHOPIFY_EXAMPLE_ACTION_ID=${extension.uuid}`,
    )
  })
})

test('writes a skipped JSON result when there are no extensions', async () => {
  await withApp(async (app) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(app.directory)
      expect(JSON.parse(stdout())).toMatchObject({status: 'skipped', extensions: [], identifiersUpdated: false})
    })
  }, [])
})

test('leaves a failed import on the fatal path without printing a result', async () => {
  await withApp(async (app) => {
    const record = publicExtension(app.directory)
    await mkdir(record.directory)
    await mkdir(record.configurationPath)
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('write')
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runCommand(app.directory)).rejects.toThrow()
      expect(stdout()).toBe('')
    })
  })
})

test('reports completed imports as partial when saving identifiers fails', async () => {
  await withApp(async (app) => {
    const path = joinPath(app.directory, 'environment-directory')
    app.dotenv = {path, variables: {}}
    await mkdir(path)
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runCommand(app.directory)).rejects.toBeInstanceOf(AbortSilentError)
      expect(JSON.parse(stdout())).toMatchObject({
        status: 'partial',
        extensions: [publicExtension(app.directory)],
        errors: [{extensionId: null, error: {type: 'bug'}}],
        identifiersUpdated: false,
      })
    })
  })
})

test.each(['cancelled', 'partial'])(
  'waits for a pending import before writing %s JSON and exits once without postrun',
  async (status) => {
    const sibling = {...extension, uuid: '594a39be-1c11-4a47-a17c-4a7d043dbbb7', title: 'Other action'}
    await withApp(
      async (app) => {
        await mkdir(publicExtension(app.directory).directory)
        const siblingDirectory = joinPath(app.directory, 'extensions', 'other-action')
        await mkdir(siblingDirectory)
        if (status === 'partial') await mkdir(joinPath(siblingDirectory, 'shopify.extension.toml'))
        let releaseWrite!: (action: string) => void
        const pendingWrite = new Promise<string>((resolve) => {
          releaseWrite = resolve
        })
        let reportFailure!: () => void
        const failureReady = new Promise<void>((resolve) => {
          reportFailure = resolve
        })
        const originalImport = extensionImportService.importExtensions
        const importSpy = vi.spyOn(extensionImportService, 'importExtensions').mockImplementation(async (options) => {
          try {
            return await originalImport(options)
          } catch (error) {
            reportFailure()
            throw error
          }
        })
        vi.mocked(renderSelectPrompt).mockImplementation(async ({message}) => {
          if (message === 'Extensions to migrate') return 'All'
          if (typeof message === 'string' && message.includes('example-action')) return pendingWrite
          return status === 'cancelled' ? 'cancel' : 'write'
        })
        class LifecycleImportCommand extends ImportDashboardExtensions {
          async catch(error: Error): Promise<never> {
            await errorHandler(error)
            await Errors.handle(error)
            throw error
          }

          protected async init() {
            return undefined
          }
        }
        const config = await Config.load()
        const metadata = config.findCommand('app:import:dashboard-extensions')!
        vi.spyOn(config, 'findCommand').mockReturnValue({...metadata, load: async () => LifecycleImportCommand})
        const hooks = vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], failures: []})
        const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
        try {
          await withCapturedStandardStreams(async ({stdout}) => {
            const outcome = config.runCommand('app:import:dashboard-extensions', ['--path', app.directory, '--json'])
            const rejection = expect(outcome).rejects.toBeInstanceOf(AbortSilentError)
            await failureReady
            await new Promise<void>((resolve) => setImmediate(resolve))
            expect(stdout()).toBe('')
            releaseWrite('write')
            await rejection
            expect(JSON.parse(stdout())).toMatchObject({
              status,
              extensions: [publicExtension(app.directory)],
              identifiersUpdated: false,
              errors: status === 'cancelled' ? [] : [expect.objectContaining({extensionId: sibling.uuid})],
            })
          })
          expect(exit).toHaveBeenCalledExactlyOnceWith(1)
          expect(hooks.mock.calls.map(([event]) => event)).not.toContain('postrun')
          expect(reportAnalyticsEvent).toHaveBeenCalledTimes(status === 'partial' ? 1 : 0)
          expect(sendErrorToBugsnag).toHaveBeenCalledTimes(status === 'partial' ? 1 : 0)
        } finally {
          exit.mockRestore()
          importSpy.mockRestore()
        }
      },
      [extension, sibling],
    )
  },
)
