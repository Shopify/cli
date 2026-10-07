import Release from './release.js'
import {release} from '../../services/release.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {appReleaseJsonOutputSchema} from '../../services/release/types.js'
import {ReleaseVersionLookupError} from '../../services/release/version-diff.js'
import {
  configExtensionsIdentifiersReleaseBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from '../../services/context/breakdown-extensions.js'
import {deployOrReleaseConfirmationPrompt} from '../../prompts/deploy-release.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import * as system from '@shopify/cli-kit/node/system'
import {Config} from '@oclif/core'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

vi.mock('../../services/release.js')
vi.mock('../../services/app-context.js')
vi.mock('../../services/context/breakdown-extensions.js')
vi.mock('../../prompts/deploy-release.js')

const version = {
  id: 123,
  uuid: 'gid://shopify/Version/123',
  versionTag: 'v1',
  message: 'Release message',
  location: 'https://dev.shopify.com/dashboard/1/apps/1/versions/123',
  appModuleVersions: [],
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('app release command', () => {
  beforeEach(() => {
    vi.mocked(linkedAppContext).mockReset()
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
    } as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(release).mockResolvedValue({status: 'success', version})
  })

  test('exposes its schema and JSON flag in help', () => {
    expect(Release.jsonOutputSchema).toBe(appReleaseJsonOutputSchema)
    expect(Release.description).toContain('AppReleaseResult')
    expect(Release.flags.json.char).toBe('j')
  })

  test('writes one JSON result and sends diagnostics to stderr', async () => {
    vi.mocked(release).mockImplementationOnce(async () => {
      outputInfo('Releasing an app version')
      return {status: 'success', version}
    })
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const result = await runRelease(['--path', tmp, '--version', 'v1', '--json', '--no-input', '--allow-updates'])
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          app: {name: 'app1', clientId: 'api-key'},
          release: {version: {gid: version.uuid, name: 'v1', message: 'Release message', url: version.location}},
        })
        expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Releasing an app version'})
        expect(result).toEqual({app: testAppLinked()})
        expect(release).toHaveBeenCalledWith(expect.objectContaining({version: 'v1', force: false, allowUpdates: true}))
      })
    })
  })

  test('writes cancelled after a declined confirmation', async () => {
    vi.mocked(release).mockResolvedValue({status: 'cancelled'})
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(runRelease(['--path', tmp, '--version', 'v1', '--json', '--allow-updates'])).rejects.toThrow()
        expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
        expect(stderr()).toBe('')
      })
    })
  })

  test('real release execution sends task progress to stderr and one result to stdout', async () => {
    const {release: executeRelease} =
      await vi.importActual<typeof import('../../services/release.js')>('../../services/release.js')
    vi.mocked(release).mockImplementationOnce(executeRelease)
    vi.mocked(extensionsIdentifiersReleaseBreakdown).mockResolvedValue({
      extensionIdentifiersBreakdown: {onlyRemote: [], toCreate: [], toUpdate: [], unchanged: []},
      versionDetails: version,
    })
    vi.mocked(configExtensionsIdentifiersReleaseBreakdown).mockReturnValue(undefined)
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    const developerPlatformClient = testDeveloperPlatformClient({release: async () => ({appRelease: {}})})
    const remoteApp = testOrganizationApp()
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp,
      developerPlatformClient,
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runRelease(['--path', tmp, '--version', 'v1', '--json', '--no-input', '--allow-updates'])
        expect(JSON.parse(stdout())).toMatchObject({status: 'success', release: {version: {gid: version.uuid}}})
        expect(
          stderr()
            .trim()
            .split('\n')
            .map((event) => JSON.parse(event)),
        ).toEqual([
          expect.objectContaining({type: 'progress', status: 'started', message: 'Releasing version'}),
          expect.objectContaining({type: 'progress', status: 'completed', message: 'Releasing version'}),
        ])
        expect(developerPlatformClient.release).toHaveBeenCalledWith({
          app: remoteApp,
          version: {versionId: version.uuid, appVersionId: 123},
        })
      })
    })
  })

  test.each(['success', 'cancelled'] as const)(
    'runs success hooks only for a completed command: %s',
    async (status) => {
      class ControlledRelease extends Release {
        async catch(error: Error): Promise<never> {
          throw error
        }

        protected async init(): Promise<void> {}
      }

      vi.mocked(release).mockResolvedValue(
        status === 'cancelled' ? {status: 'cancelled'} : {status: 'success', version},
      )
      await inTemporaryDirectory(async (directory) => {
        const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
        const runHook = vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], failures: []})
        const cachedCommand = {
          id: 'app:release',
          aliases: [],
          hiddenAliases: [],
          hidden: false,
          args: {},
          flags: {},
          load: async () => ControlledRelease,
        }
        try {
          await withCapturedStandardStreams(async ({stdout, stderr}) => {
            const execution = config.runCommand(
              'app:release',
              ['--path', directory, '--version', 'v1', '--json', '--allow-updates'],
              cachedCommand,
            )
            if (status === 'cancelled') {
              await expect(execution).rejects.toMatchObject({oclif: {exit: 0}})
              expect(runHook).not.toHaveBeenCalledWith('postrun', expect.anything())
            } else {
              await execution
              expect(runHook).toHaveBeenCalledWith('postrun', expect.anything())
            }
            expect(JSON.parse(stdout())).toMatchObject({status})
            expect(stderr()).toBe('')
          })
        } finally {
          runHook.mockRestore()
        }
      })
    },
  )

  test('retains silent cancellation in text mode', async () => {
    vi.mocked(release).mockResolvedValue({status: 'cancelled'})
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(runRelease(['--path', tmp, '--version', 'v1', '--allow-updates'])).rejects.toThrow()
        expect(stdout()).toBe('')
      })
    })
  })

  test('a failed release uses the shared error document without a result', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    const userErrors = [{message: 'Release failed.', category: 'validation', details: [], field: ['version']}]
    vi.mocked(release).mockResolvedValue({status: 'failed', version, userErrors})
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(runRelease(['--path', tmp, '--version', 'v1', '--json', '--allow-updates'])).rejects.toThrow()
        expect(JSON.parse(stdout())).toMatchObject({
          error: {type: 'abort', message: "Version couldn't be released.", details: {userErrors}},
        })
        expect(stderr()).toBe('')
      })
    })
  })

  test('a missing version retains the upstream fatal error', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(release).mockRejectedValue(
      new ReleaseVersionLookupError('missing', new AbortError('Version not found for tag: missing')),
    )
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(runRelease(['--path', tmp, '--version', 'missing', '--json', '--allow-updates'])).rejects.toThrow()
        expect(JSON.parse(stdout())).toMatchObject({
          error: {type: 'abort', message: 'Version not found for tag: missing'},
        })
        expect(stderr()).toBe('')
      })
    })
  })

  test('does not report a silent failure as cancellation', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(release).mockRejectedValue(new AbortSilentError())
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(runRelease(['--path', tmp, '--version', 'v1', '--json', '--allow-updates'])).rejects.toThrow()
        expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort'}})
      })
    })
  })

  test('JSON does not disable confirmation policy', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.spyOn(system, 'terminalSupportsPrompting').mockReturnValue(false)
    try {
      await inTemporaryDirectory(async (tmp) => {
        await withCapturedStandardStreams(async ({stdout}) => {
          await expect(runRelease(['--path', tmp, '--version', 'v1', '--json'])).rejects.toThrow()
          expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort'}})
          expect(release).not.toHaveBeenCalled()
        })
      })
    } finally {
      vi.mocked(system.terminalSupportsPrompting).mockRestore()
    }
  })

  test('JSON remains interactive when input is available', async () => {
    vi.spyOn(system, 'terminalSupportsPrompting').mockReturnValue(true)
    try {
      await inTemporaryDirectory(async (tmp) => {
        await withCapturedStandardStreams(async ({stdout}) => {
          await runRelease(['--path', tmp, '--version', 'v1', '--json'])
          expect(JSON.parse(stdout())).toMatchObject({status: 'success'})
          expect(release).toHaveBeenCalledWith(
            expect.objectContaining({allowUpdates: undefined, allowDeletes: undefined, force: false}),
          )
        })
      })
    } finally {
      vi.mocked(system.terminalSupportsPrompting).mockRestore()
    }
  })

  test('no-input alone keeps text output', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runRelease(['--path', tmp, '--version', 'v1', '--no-input', '--allow-updates'])
        expect(stdout()).toBe('')
        expect(stderr()).toContain('Version released to users.')
      })
    })
  })

  test('requires a version before loading app context', async () => {
    await expect(runRelease(['--json', '--allow-updates'])).rejects.toThrow()
    expect(linkedAppContext).not.toHaveBeenCalled()
  })

  test('rejects unsupported environment batches', async () => {
    await expect(runRelease(['--version', 'v1', '--allow-updates', '--environment', 'production'])).rejects.toThrow()
    expect(release).not.toHaveBeenCalled()
  })
})

async function runRelease(argv: string[]) {
  const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
  // The source package is bundled in the installed CLI, not a custom plugin.
  config.plugins.delete('@shopify/app')
  return Release.run(argv, config)
}
