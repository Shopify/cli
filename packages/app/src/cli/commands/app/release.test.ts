import Release from './release.js'
import {release} from '../../services/release.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {errorHandler} from '@shopify/cli-kit/node/error-handler'
import {Config, Errors} from '@oclif/core'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

vi.mock('../../services/release.js')
vi.mock('../../services/app-context.js')

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
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
    } as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(release).mockResolvedValue({status: 'success', version})
  })

  test('writes one JSON result and sends diagnostics to stderr', async () => {
    vi.mocked(release).mockImplementationOnce(async () => {
      outputInfo('Releasing an app version')
      return {status: 'success', version}
    })
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runRelease(['--path', tmp, '--version', 'v1', '--json', '--allow-updates'])
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          app: {name: 'app1', clientId: 'api-key'},
          release: {version: {gid: version.uuid, name: 'v1', message: 'Release message', url: version.location}},
        })
        expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Releasing an app version'})
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

  test('cancelled JSON exits zero without running success hooks', async () => {
    class CancelledRelease extends Release {
      async catch(error: Error): Promise<never> {
        await errorHandler(error)
        await Errors.handle(error)
        throw error
      }

      protected async init(): Promise<void> {}
    }
    vi.mocked(release).mockResolvedValue({status: 'cancelled'})
    const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
    const runHook = vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], failures: []})
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    try {
      await inTemporaryDirectory(async (directory) => {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await expect(
            config.runCommand('app:release', ['--path', directory, '--version', 'v1', '--json', '--allow-updates'], {
              id: 'app:release',
              aliases: [],
              hiddenAliases: [],
              hidden: false,
              args: {},
              flags: {},
              load: async () => CancelledRelease,
            }),
          ).rejects.toBeInstanceOf(AbortSilentError)
          expect(exit).toHaveBeenCalledExactlyOnceWith(0)
          expect(runHook).not.toHaveBeenCalledWith('postrun', expect.anything())
          expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
          expect(stderr()).toBe('')
        })
      })
    } finally {
      runHook.mockRestore()
      exit.mockRestore()
    }
  })
})

async function runRelease(argv: string[]) {
  const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
  // The source package is bundled in the installed CLI, not a custom plugin.
  config.plugins.delete('@shopify/app')
  return Release.run(argv, config)
}
