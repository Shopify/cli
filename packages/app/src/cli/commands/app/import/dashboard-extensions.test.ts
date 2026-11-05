import ImportDashboardExtensions from './dashboard-extensions.js'
import ImportExtensions from '../import-extensions.js'
import {linkedAppContext} from '../../../services/app-context.js'
import * as extensionImportService from '../../../services/import-extensions.js'
import {importDashboardExtensionsJsonOutputSchema} from '../../../services/import-extensions/types.js'
import {
  testAppLinked,
  testOrganizationApp,
  testDeveloperPlatformClient,
  testUIExtension,
} from '../../../models/app/app.test-data.js'
import {ExtensionRegistration} from '../../../api/graphql/all_app_extension_registrations.js'
import {Config, Errors} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import * as output from '@shopify/cli-kit/node/output'
import * as ui from '@shopify/cli-kit/node/ui'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import * as errorHandlers from '@shopify/cli-kit/node/error-handler'
import {AbortError, AbortSilentError, handler} from '@shopify/cli-kit/node/error'

vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/analytics')

afterEach(() => vi.unstubAllEnvs())

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
      output.outputInfo('Loaded dashboard extensions')
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
    vi.spyOn(ui, 'renderSelectPrompt').mockResolvedValue(extension.uuid)
    vi.spyOn(errorHandlers, 'sendErrorToBugsnag').mockResolvedValue({
      reported: false,
      error: undefined,
      unhandled: undefined,
    })
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

async function runCommand(directory: string, Command = ImportDashboardExtensions, extraArgs: string[] = []) {
  const args = ['--path', directory, '--json', ...extraArgs]
  const command = new Command(args, await Config.load())
  return runWithCommandEventsForCommand(args, () => command.run())
}

async function expectFlushedSilentExit(run: () => Promise<unknown>) {
  let finishFlush!: () => void
  const pendingFlush = new Promise<void>((resolve) => {
    finishFlush = resolve
  })
  let signalFlush!: () => void
  const flushing = new Promise<void>((resolve) => {
    signalFlush = resolve
  })
  const flush = vi.spyOn(output, 'flushStdout').mockImplementation(async () => {
    signalFlush()
    await pendingFlush
  })
  let settled = false
  const outcome = run().finally(() => {
    settled = true
  })
  const rejection = expect(outcome).rejects.toBeInstanceOf(AbortSilentError)
  try {
    await Promise.race([flushing, rejection])
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(flush).toHaveBeenCalledExactlyOnceWith()
    expect(settled).toBe(false)
  } finally {
    finishFlush()
    flush.mockRestore()
    await rejection
  }
}

test.each([{Command: ImportDashboardExtensions}, {Command: ImportExtensions}])(
  '$Command.name exposes JSON flags and its result schema',
  ({Command}) => {
    expect(Command.flags.json).toBeDefined()
    expect(Command.flags['no-input']).toBeDefined()
    expect(Command.jsonOutputSchema).toBe(importDashboardExtensionsJsonOutputSchema)
    expect(Command.description).toContain('ImportDashboardExtensionsResult')
  },
)

test.each([
  {action: 'write', Command: ImportDashboardExtensions},
  {action: 'skip', Command: ImportDashboardExtensions},
  {action: 'skip-without-toml', Command: ImportDashboardExtensions},
  {action: 'write', Command: ImportExtensions},
])(
  '$Command.name writes $action JSON after saving identifiers and sends diagnostics to stderr',
  async ({action, Command}) => {
    await withApp(async (app) => {
      const record = publicExtension(app.directory)
      const localToml = 'name = "Local action"\n# Preserve this comment.\n'
      if (action !== 'write') {
        await mkdir(record.directory)
        if (action === 'skip') await writeFile(record.configurationPath, localToml)
        vi.mocked(ui.renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('skip')
      }
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runCommand(app.directory, Command)
        const result = JSON.parse(stdout())
        expect(result).toEqual({
          status: 'success',
          reason: null,
          extensions: [
            {
              ...record,
              configurationPath: action === 'skip-without-toml' ? null : record.configurationPath,
              changed: action === 'write',
            },
          ],
          errors: [],
          identifiersUpdated: true,
        })
        const events = stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events).toContainEqual(
          expect.objectContaining({type: 'diagnostic', message: 'Loaded dashboard extensions'}),
        )
        if (Command === ImportExtensions) {
          expect(events).toContainEqual(
            expect.objectContaining({
              level: 'warning',
              message: expect.stringContaining('app import-extensions has moved.'),
            }),
          )
        }
        expect(() => importDashboardExtensionsJsonOutputSchema.encode({...result, internal: true})).toThrow()
      })
      if (action === 'skip') await expect(readFile(record.configurationPath)).resolves.toBe(localToml)
      if (action === 'skip-without-toml') await expect(fileExists(record.configurationPath)).resolves.toBe(false)
      if (action === 'write') {
        await expect(readFile(record.configurationPath)).resolves.toBe(
          '[[extensions]]\ntype = "flow_action"\nname = "Example action"\nhandle = "example-action"\n' +
            'description = "A description"\nruntime_url = "https://example.com/run"\n',
        )
      }
      await expect(readFile(joinPath(app.directory, '.env'))).resolves.toContain(
        `SHOPIFY_EXAMPLE_ACTION_ID=${extension.uuid}`,
      )
    })
  },
)

test('writes a skipped JSON result when there are no extensions', async () => {
  await withApp(async (app) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(app.directory)
      expect(JSON.parse(stdout())).toMatchObject({status: 'skipped', extensions: [], identifiersUpdated: false})
    })
  }, [])
})

test.each([false, true])('preserves text failure and reports an already-imported JSON no-op: %s', async (json) => {
  const otherExtension = {
    ...extension,
    uuid: '594a39be-1c11-4a47-a17c-4a7d043dbbb7',
    type: 'marketing_activity_extension',
  }
  await withApp(
    async (app) => {
      const localExtension = await testUIExtension({handle: 'example-action'})
      const otherLocalExtension = await testUIExtension({handle: 'other-action'})
      app.realExtensions = [localExtension, otherLocalExtension]
      const dotenvPath = joinPath(app.directory, '.env')
      const dotenv = 'EXISTING=value\n'
      app.dotenv = {
        path: dotenvPath,
        variables: {
          [localExtension.idEnvironmentVariableName]: extension.uuid,
          [otherLocalExtension.idEnvironmentVariableName]: otherExtension.uuid,
        },
      }
      await writeFile(dotenvPath, dotenv)
      await withCapturedStandardStreams(async ({stdout}) => {
        if (json) {
          await runCommand(app.directory, ImportDashboardExtensions, ['--no-input'])
          expect(JSON.parse(stdout())).toEqual({
            status: 'skipped',
            reason: 'no-extensions',
            extensions: [],
            errors: [],
            identifiersUpdated: false,
          })
        } else {
          const command = new ImportDashboardExtensions(['--path', app.directory], await Config.load())
          await expect(command.run()).rejects.toThrow('No extensions to migrate')
          expect(stdout()).toBe('')
        }
        expect(ui.renderSelectPrompt).not.toHaveBeenCalled()
      })
      await expect(readFile(dotenvPath)).resolves.toBe(dotenv)
    },
    json ? [extension, otherExtension] : [extension],
  )
})

test('reports missing non-interactive selection through the JSON fatal path', async () => {
  await withApp(async (app) => {
    vi.mocked(ui.renderSelectPrompt).mockRestore()
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout}) => {
      const failure = await runCommand(app.directory, ImportDashboardExtensions, ['--no-input']).catch((error) => error)
      expect(failure).toBeInstanceOf(AbortError)
      expect(stdout()).toBe('')
      await runWithCommandEventsForCommand(['--json', '--no-input'], () => handler(failure))
      expect(JSON.parse(stdout())).toMatchObject({
        error: {type: 'abort', message: expect.stringContaining('Failed to prompt:')},
      })
    })
  })
})

test.each([false, true])('preserves the original fatal import error without a result: JSON %s', async (json) => {
  await withApp(async (app) => {
    const record = publicExtension(app.directory)
    await mkdir(record.directory)
    await mkdir(record.configurationPath)
    vi.mocked(ui.renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('write')
    let importError: unknown
    const originalImport = extensionImportService.importExtensions
    const importSpy = vi.spyOn(extensionImportService, 'importExtensions').mockImplementation(async (options) => {
      try {
        return await originalImport(options)
      } catch (error) {
        importError = error
        throw error
      }
    })
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        const command = new ImportDashboardExtensions(['--path', app.directory], await Config.load())
        const failure = await (json ? runCommand(app.directory) : command.run()).catch((error) => error)
        expect(importError).toBeInstanceOf(extensionImportService.ExtensionImportFailedError)
        expect(failure).toBe((importError as extensionImportService.ExtensionImportFailedError).originalError)
        expect(stdout()).toBe('')
      })
    } finally {
      importSpy.mockRestore()
    }
  })
})

test('reports completed imports as partial when saving identifiers fails', async () => {
  await withApp(async (app) => {
    const path = joinPath(app.directory, 'environment-directory')
    app.dotenv = {path, variables: {}}
    await mkdir(path)
    await withCapturedStandardStreams(async ({stdout}) => {
      await expectFlushedSilentExit(() => runCommand(app.directory))
      expect(JSON.parse(stdout())).toMatchObject({
        status: 'partial',
        extensions: [publicExtension(app.directory)],
        errors: [{extensionId: null, error: {type: 'bug'}}],
        identifiersUpdated: false,
      })
    })
  })
})

test.each([
  {name: 'cancellation', status: 'cancelled', cancel: true, fail: false},
  {name: 'failure', status: 'partial', cancel: false, fail: true},
  {name: 'cancellation followed by failure', status: 'partial', cancel: true, fail: true},
])('$name waits for pending imports before writing one $status JSON result', async (row) => {
  const cancelledExtension = {...extension, uuid: '594a39be-1c11-4a47-a17c-4a7d043dbbb7', title: 'Cancelled action'}
  const failedExtension = {...extension, uuid: 'd8fb83d0-011b-47a4-b61e-4d304d352ca9', title: 'Failed action'}
  await withApp(
    async (app) => {
      await mkdir(publicExtension(app.directory).directory)
      if (row.cancel) await mkdir(joinPath(app.directory, 'extensions', 'cancelled-action'))
      if (row.fail) await mkdir(joinPath(app.directory, 'extensions', 'failed-action', 'shopify.extension.toml'))
      let releaseWrite!: (action: string) => void
      const pendingWrite = new Promise<string>((resolve) => {
        releaseWrite = resolve
      })
      let reportFailure!: () => void
      const failureReady = new Promise<void>((resolve) => {
        reportFailure = resolve
      })
      let importError: unknown
      const originalImport = extensionImportService.importExtensions
      const importSpy = vi.spyOn(extensionImportService, 'importExtensions').mockImplementation(async (options) => {
        try {
          return await originalImport(options)
        } catch (error) {
          importError = error
          reportFailure()
          throw error
        }
      })
      vi.mocked(ui.renderSelectPrompt).mockImplementation(async ({message}) => {
        if (message === 'Extensions to migrate') return 'All'
        if (typeof message === 'string' && message.includes('example-action')) return pendingWrite
        if (typeof message === 'string' && message.includes('cancelled-action')) return 'cancel'
        if (row.cancel) await failureReady
        return 'write'
      })
      class LifecycleImportCommand extends ImportDashboardExtensions {
        async catch(error: Error): Promise<never> {
          await errorHandlers.errorHandler(error)
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
          const rejection = expectFlushedSilentExit(() =>
            config.runCommand('app:import:dashboard-extensions', ['--path', app.directory, '--json']),
          )
          await failureReady
          await new Promise<void>((resolve) => setImmediate(resolve))
          expect(stdout()).toBe('')
          releaseWrite('write')
          await rejection
          expect(JSON.parse(stdout())).toMatchObject({
            status: row.status,
            reason: row.status === 'cancelled' ? 'directory-selection-cancelled' : null,
            extensions: [publicExtension(app.directory)],
            identifiersUpdated: false,
            errors: row.fail ? [expect.objectContaining({extensionId: failedExtension.uuid})] : [],
          })
        })
        expect(exit).toHaveBeenCalledExactlyOnceWith(1)
        expect(hooks.mock.calls.map(([event]) => event)).not.toContain('postrun')
        expect(reportAnalyticsEvent).toHaveBeenCalledTimes(row.fail ? 1 : 0)
        expect(errorHandlers.sendErrorToBugsnag).toHaveBeenCalledTimes(row.fail ? 1 : 0)
        if (row.fail) {
          const completion = await (
            importError as
              | extensionImportService.ExtensionImportFailedError
              | extensionImportService.ExtensionImportCancelledError
          ).completedImports()
          const originalError = completion.failures[0]!.error
          expect(reportAnalyticsEvent).toHaveBeenCalledExactlyOnceWith({
            config,
            errorMessage: originalError instanceof Error ? originalError.message : undefined,
            exitMode: 'unexpected_error',
          })
          expect(errorHandlers.sendErrorToBugsnag).toHaveBeenCalledExactlyOnceWith(originalError, 'unexpected_error')
        }
      } finally {
        exit.mockRestore()
        importSpy.mockRestore()
      }
    },
    [extension, ...(row.cancel ? [cancelledExtension] : []), ...(row.fail ? [failedExtension] : [])],
  )
})
