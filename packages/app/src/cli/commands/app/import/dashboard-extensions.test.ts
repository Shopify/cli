import ImportDashboardExtensions from './dashboard-extensions.js'
import ImportExtensionsDeprecated from '../import-extensions.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {ExtensionImportCancelledError, ExtensionImportFailedError} from '../../../services/import-extensions.js'
import * as extensionImportService from '../../../services/import-extensions.js'
import {importDashboardExtensionsJsonOutputSchema} from '../../../services/import-extensions/types.js'
import {testAppLinked, testOrganizationApp, testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {ExtensionRegistration} from '../../../api/graphql/all_app_extension_registrations.js'
import {Config, Errors} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {sendErrorToBugsnag} from '@shopify/cli-kit/node/error-handler'
import {AbortError, AbortSilentError, handler} from '@shopify/cli-kit/node/error'

// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/error-handler')
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
const expectedToml =
  '[[extensions]]\ntype = "flow_action"\nname = "Example action"\nhandle = "example-action"\ndescription = "A description"\nruntime_url = "https://example.com/run"\n'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function withApp(run: (app: ReturnType<typeof testAppLinked>) => Promise<void>, extensions = [extension]) {
  vi.stubGlobal('console', {...globalThis.console, Console})
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
    vi.mocked(renderSelectPrompt).mockResolvedValue(extension.uuid)
    await run(app)
  })
}

async function runCommand(directory: string, argv: string[], deprecated = false) {
  const Command = deprecated ? ImportExtensionsDeprecated : ImportDashboardExtensions
  const args = ['--path', directory, ...argv]
  const command = new Command(args, await Config.load())
  return runWithCommandEventsForCommand(args, () => command.run())
}

async function handleSilentExit(outcome: unknown) {
  expect(outcome).toBeInstanceOf(AbortSilentError)
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await handler(outcome)
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit)
  try {
    await Errors.handle(outcome as AbortSilentError)
    expect(exit).toHaveBeenCalledWith(1)
  } finally {
    exit.mockRestore()
  }
}

function publicExtension(directory: string, changed = true, ext = extension) {
  const extensionDirectory = joinPath(
    directory,
    'extensions',
    ext.title === extension.title ? 'example-action' : 'other-action',
  )
  return {
    id: ext.uuid,
    name: ext.title,
    type: ext.type,
    directory: extensionDirectory,
    configurationPath: joinPath(extensionDirectory, 'shopify.extension.toml'),
    changed,
  }
}

test('writes one JSON result, diagnostics on stderr, native TOML, and extension identifiers', async () => {
  await withApp(async (app) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(runCommand(app.directory, ['--json'])).resolves.toEqual({app})
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        reason: null,
        extensions: [publicExtension(app.directory)],
        errors: [],
        identifiersUpdated: true,
      })
      expect(
        stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)),
      ).toEqual([expect.objectContaining({type: 'diagnostic', level: 'info', message: 'Loaded dashboard extensions'})])
      expect(stderr()).not.toContain('Imported the following')
    })
    await expect(readFile(publicExtension(app.directory).configurationPath)).resolves.toBe(expectedToml)
    await expect(readFile(joinPath(app.directory, '.env'))).resolves.toContain(
      `SHOPIFY_EXAMPLE_ACTION_ID=${extension.uuid}`,
    )
    expect(app.dotenv?.variables.SHOPIFY_EXAMPLE_ACTION_ID).toBe(extension.uuid)
    await expect(fileExists(joinPath(app.directory, 'extensions', 'example-action', '.shopify.lock'))).resolves.toBe(
      false,
    )
  })
})

test('keeps native local TOML unchanged and still persists identifiers when the picker selects Keep', async () => {
  await withApp(async (app) => {
    const {directory, configurationPath} = publicExtension(app.directory)
    await mkdir(directory)
    const localToml = '# Local café\r\n[[extensions]]\r\nname = "Local action"\r\n'
    await writeFile(configurationPath, localToml)
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('skip')
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(app.directory, ['--json'])
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        reason: null,
        extensions: [publicExtension(app.directory, false)],
        errors: [],
        identifiersUpdated: true,
      })
    })
    await expect(readFile(configurationPath)).resolves.toBe(localToml)
    await expect(readFile(joinPath(app.directory, '.env'))).resolves.toContain(
      `SHOPIFY_EXAMPLE_ACTION_ID=${extension.uuid}`,
    )
  })
})

test('does not report a TOML artifact for an empty kept directory', async () => {
  await withApp(async (app) => {
    await mkdir(publicExtension(app.directory).directory)
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('skip')
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(app.directory, ['--json'])
      expect(JSON.parse(stdout())).toMatchObject({extensions: [{changed: false, configurationPath: null}]})
    })
  })
})

test('returns a skipped result without writing identifiers when no remote extensions exist', async () => {
  await withApp(async (app) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(app.directory, ['--json'])
      expect(JSON.parse(stdout())).toEqual({
        status: 'skipped',
        reason: 'no-extensions',
        extensions: [],
        errors: [],
        identifiersUpdated: false,
      })
    })
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    await expect(fileExists(joinPath(app.directory, '.env'))).resolves.toBe(false)
  }, [])
})

test('keeps the success banner and relative extension path on stderr in text mode', async () => {
  await withApp(async (app) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(app.directory, [])
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toContain('Imported the following extensions from the dashboard:')
      expect(unstyled(stderr())).toContain('"Example action" at: extensions/example-action')
    })
    await expect(readFile(publicExtension(app.directory).configurationPath)).resolves.toBe(expectedToml)
  })
})

test('returns one cancelled document and exit 1 for the existing-directory Cancel selection', async () => {
  await withApp(async (app) => {
    await mkdir(publicExtension(app.directory).directory)
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('cancel')
    await withCapturedStandardStreams(async ({stdout}) => {
      const error = await runCommand(app.directory, ['--json']).catch((failure: unknown) => failure)
      await handleSilentExit(error)
      expect(JSON.parse(stdout())).toEqual({
        status: 'cancelled',
        reason: 'directory-selection-cancelled',
        extensions: [],
        errors: [],
        identifiersUpdated: false,
      })
    })
    await expect(fileExists(joinPath(app.directory, '.env'))).resolves.toBe(false)
  })
})

test('preserves AbortSilentError and the standard exit 1 in text mode', async () => {
  await withApp(async (app) => {
    await mkdir(publicExtension(app.directory).directory)
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('cancel')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const error = await runCommand(app.directory, []).catch((failure: AbortSilentError) => failure)
      expect(error).toBeInstanceOf(AbortSilentError)
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as typeof process.exit)
      await Errors.handle(error as AbortSilentError)
      expect(exit).toHaveBeenCalledWith(1)
      exit.mockRestore()
      expect(stdout()).toBe('')
      expect(stderr()).not.toContain('Imported the following')
    })
  })
})

test.each(['json', 'text'])('preserves pending sibling writes when another picker cancels (%s)', async (format) => {
  const sibling = {...extension, uuid: '594a39be-1c11-4a47-a17c-4a7d043dbbb7', title: 'Other action'}
  await withApp(
    async (app) => {
      await mkdir(publicExtension(app.directory).directory)
      await mkdir(publicExtension(app.directory, true, sibling).directory)
      let releaseWrite!: () => void
      const writeReady = new Promise<string>((resolve) => {
        releaseWrite = () => resolve('write')
      })
      let selectCancelled!: () => void
      const cancelled = new Promise<void>((resolve) => {
        selectCancelled = resolve
      })
      vi.mocked(renderSelectPrompt).mockImplementation(async ({message}) => {
        if (message === 'Extensions to migrate') return 'All'
        if (typeof message === 'string' && message.includes('example-action')) return writeReady
        selectCancelled()
        return 'cancel'
      })
      await withCapturedStandardStreams(async ({stdout}) => {
        const command = runCommand(app.directory, format === 'json' ? ['--json'] : [])
        const outcome = command.catch((error: ExtensionImportCancelledError) => error)
        await cancelled
        expect(stdout()).toBe('')
        if (format === 'text') {
          const error = await outcome
          expect(error).toBeInstanceOf(ExtensionImportCancelledError)
          await expect(fileExists(publicExtension(app.directory).configurationPath)).resolves.toBe(false)
          releaseWrite()
          const completed = await (error as ExtensionImportCancelledError).completedImports()
          expect(completed.extensions).toHaveLength(1)
        } else {
          releaseWrite()
          await handleSilentExit(await outcome)
          expect(JSON.parse(stdout())).toEqual({
            status: 'cancelled',
            reason: 'directory-selection-cancelled',
            extensions: [publicExtension(app.directory)],
            errors: [],
            identifiersUpdated: false,
          })
        }
      })
      await expect(readFile(publicExtension(app.directory).configurationPath)).resolves.toBe(expectedToml)
      await expect(fileExists(joinPath(app.directory, '.env'))).resolves.toBe(false)
    },
    [extension, sibling],
  )
})

test.each(['json', 'text'])('preserves identifier-write failure ordering (%s)', async (format) => {
  await withApp(async (app) => {
    const dotenvPath = joinPath(app.directory, 'environment-directory')
    app.dotenv = {path: dotenvPath, variables: {}}
    await mkdir(dotenvPath)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      if (format === 'text') {
        await expect(runCommand(app.directory, [])).rejects.toThrow()
        expect(stdout()).toBe('')
        expect(unstyled(stderr())).toContain('Imported the following extensions from the dashboard:')
      } else {
        await handleSilentExit(await runCommand(app.directory, ['--json']).catch((failure: unknown) => failure))
        expect(JSON.parse(stdout())).toMatchObject({
          status: 'partial',
          extensions: [publicExtension(app.directory)],
          errors: [{extensionId: null, error: {type: 'bug', code: 'EISDIR'}}],
          identifiersUpdated: false,
        })
        expect(stderr()).not.toContain('Imported the following')
      }
    })
    await expect(readFile(publicExtension(app.directory).configurationPath)).resolves.toBe(expectedToml)
  })
})

test.each(['json', 'text'])(
  'waits for a delayed successful sibling after a write failure only in JSON (%s)',
  async (format) => {
    const sibling = {...extension, uuid: '594a39be-1c11-4a47-a17c-4a7d043dbbb7', title: 'Other action'}
    await withApp(
      async (app) => {
        await mkdir(publicExtension(app.directory).directory)
        await mkdir(publicExtension(app.directory, true, sibling).directory)
        await mkdir(publicExtension(app.directory, true, sibling).configurationPath)
        let releaseWrite!: () => void
        const writeReady = new Promise<string>((resolve) => {
          releaseWrite = () => resolve('write')
        })
        let reportFailure!: (error: ExtensionImportFailedError) => void
        const failedWrite = new Promise<ExtensionImportFailedError>((resolve) => {
          reportFailure = resolve
        })
        const realImport = extensionImportService.importExtensions
        const importSpy = vi.spyOn(extensionImportService, 'importExtensions').mockImplementation(async (options) => {
          try {
            return await realImport(options)
          } catch (error) {
            if (error instanceof ExtensionImportFailedError) reportFailure(error)
            throw error
          }
        })
        vi.mocked(renderSelectPrompt).mockImplementation(async ({message}) => {
          if (message === 'Extensions to migrate') return 'All'
          if (typeof message === 'string' && message.includes('example-action')) return writeReady
          return 'write'
        })
        await withCapturedStandardStreams(async ({stdout}) => {
          const outcome = runCommand(app.directory, format === 'json' ? ['--json'] : []).catch(
            (error: unknown) => error,
          )
          const failure = await failedWrite
          expect(stdout()).toBe('')
          if (format === 'text') {
            await expect(outcome).resolves.toBe(failure.originalError)
            await expect(fileExists(publicExtension(app.directory).configurationPath)).resolves.toBe(false)
            releaseWrite()
            await failure.completedImports()
          } else {
            releaseWrite()
            await handleSilentExit(await outcome)
            expect(JSON.parse(stdout())).toMatchObject({
              status: 'partial',
              reason: null,
              extensions: [publicExtension(app.directory)],
              errors: [{extensionId: sibling.uuid, error: {type: 'bug', code: 'EISDIR'}}],
              identifiersUpdated: false,
            })
          }
        })
        importSpy.mockRestore()
        await expect(readFile(publicExtension(app.directory).configurationPath)).resolves.toBe(expectedToml)
        await expect(fileExists(joinPath(app.directory, '.env'))).resolves.toBe(false)
      },
      [extension, sibling],
    )
  },
)

test('all failed imports retain the first original error and emit one shared fatal document', async () => {
  const sibling = {...extension, uuid: '594a39be-1c11-4a47-a17c-4a7d043dbbb7', title: 'Other action'}
  await withApp(
    async (app) => {
      await Promise.all(
        [extension, sibling].map(async (ext) => {
          const record = publicExtension(app.directory, true, ext)
          await mkdir(record.directory)
          await mkdir(record.configurationPath)
        }),
      )
      vi.mocked(renderSelectPrompt).mockResolvedValueOnce('All').mockResolvedValue('write')
      await withCapturedStandardStreams(async ({stdout}) => {
        const error = await runCommand(app.directory, ['--json']).catch((failure: unknown) => failure)
        expect(error).toMatchObject({code: 'EISDIR'})
        expect(stdout()).toBe('')
        vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
        await runWithCommandEventsForCommand(['--json'], () => handler(error as Error))
        expect(JSON.parse(stdout())).toMatchObject({error: {type: 'bug', message: expect.stringContaining('EISDIR')}})
      })
      await expect(fileExists(joinPath(app.directory, '.env'))).resolves.toBe(false)
    },
    [extension, sibling],
  )
})

test('keeps transport errors on the fatal path without printing a result first', async () => {
  await withApp(async (app) => {
    vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('Authentication failed'))
    await withCapturedStandardStreams(async ({stdout}) => {
      const error = await runCommand(app.directory, ['--json']).catch((failure: AbortError) => failure)
      expect(stdout()).toBe('')
      vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      await runWithCommandEventsForCommand(['--json'], () => handler(error as AbortError))
      expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort', message: 'Authentication failed'}})
    })
  })
})

test.each([
  {argv: [], disabled: false},
  {argv: ['--json'], disabled: false},
  {argv: ['--no-input'], disabled: true},
  {argv: ['--json', '--no-input'], disabled: true},
])('keeps input policy independent of output formatting: $argv', async ({argv, disabled}) => {
  await withApp(async (app) => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', disabled ? '1' : '0')
    const realUi = await vi.importActual<typeof import('@shopify/cli-kit/node/ui')>('@shopify/cli-kit/node/ui')
    if (disabled) vi.mocked(renderSelectPrompt).mockImplementation(realUi.renderSelectPrompt)
    await withCapturedStandardStreams(async ({stdout}) => {
      if (disabled) {
        await expect(runCommand(app.directory, argv)).rejects.toThrow('Failed to prompt:')
        expect(stdout()).toBe('')
        await expect(fileExists(publicExtension(app.directory).configurationPath)).resolves.toBe(false)
      } else {
        await runCommand(app.directory, argv)
        expect(renderSelectPrompt).toHaveBeenCalledWith(expect.objectContaining({message: 'Extensions to migrate'}))
        if (argv.includes('--json')) expect(JSON.parse(stdout())).toHaveProperty('status', 'success')
      }
    })
  })
})

test('preserves the deprecated alias and exposes schema and flags from both paths', async () => {
  expect(ImportDashboardExtensions.jsonOutputSchema).toBe(importDashboardExtensionsJsonOutputSchema)
  expect(ImportExtensionsDeprecated.jsonOutputSchema).toBe(importDashboardExtensionsJsonOutputSchema)
  expect(ImportExtensionsDeprecated.flags.json).toBeDefined()
  expect(ImportDashboardExtensions.descriptionForHelp()).toContain('`ImportDashboardExtensionsResult` schema')
  await withApp(async (app) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(app.directory, ['--json'], true)
      expect(JSON.parse(stdout())).toHaveProperty('status', 'success')
      expect(unstyled(stderr()).replaceAll('`', '')).toContain('shopify app import-extensions has moved.')
    })
  })
})

test.each(['cancelled', 'partial'])(
  'skips the success postrun hook for a JSON %s result and preserves reporting',
  async (status) => {
    await withApp(async (app) => {
      if (status === 'cancelled') {
        await mkdir(publicExtension(app.directory).directory)
        vi.mocked(renderSelectPrompt).mockResolvedValueOnce(extension.uuid).mockResolvedValueOnce('cancel')
      } else {
        const dotenvPath = joinPath(app.directory, 'environment-directory')
        app.dotenv = {path: dotenvPath, variables: {}}
        await mkdir(dotenvPath)
      }
      class LifecycleImportCommand extends ImportDashboardExtensions {
        async catch(error: Error & {skipOclifErrorHandling: boolean}): Promise<void> {
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
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(
          config.runCommand('app:import:dashboard-extensions', ['--path', app.directory, '--json']),
        ).rejects.toThrow(AbortSilentError)
        expect(JSON.parse(stdout())).toHaveProperty('status', status)
        expect(hooks.mock.calls.map(([event]) => event)).not.toContain('postrun')
      })
      if (status === 'cancelled') {
        expect(reportAnalyticsEvent).not.toHaveBeenCalled()
        expect(sendErrorToBugsnag).not.toHaveBeenCalled()
      } else {
        expect(reportAnalyticsEvent).toHaveBeenCalledOnce()
        expect(reportAnalyticsEvent).toHaveBeenCalledWith({
          config,
          errorMessage: expect.stringContaining('EISDIR'),
          exitMode: 'unexpected_error',
        })
        expect(sendErrorToBugsnag).toHaveBeenCalledOnce()
        expect(sendErrorToBugsnag).toHaveBeenCalledWith(expect.objectContaining({code: 'EISDIR'}), 'unexpected_error')
      }
    })
  },
)
