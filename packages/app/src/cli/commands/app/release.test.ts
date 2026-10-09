import Release from './release.js'
import {release} from '../../services/release.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Config} from '@oclif/core'
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

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
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

  test('release rejection uses one shared error document', async () => {
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

  test.each(['json', 'text'])('missing version uses the shared %s error handler', async (format) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', format === 'json' ? '1' : '0')
    const {release: releaseService} =
      await vi.importActual<typeof import('../../services/release.js')>('../../services/release.js')
    vi.mocked(release).mockImplementationOnce(releaseService)
    vi.mocked(linkedAppContext).mockResolvedValueOnce({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
      developerPlatformClient: testDeveloperPlatformClient({
        appVersionByTag: vi.fn().mockRejectedValue(new AbortError('HTTP 404: Cannot find a valid organization')),
      }),
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    await inTemporaryDirectory(async (directory) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const argv = ['--path', directory, '--version', 'missing', '--allow-updates']
        if (format === 'json') argv.push('--json')
        await expect(runRelease(argv)).rejects.toThrow()
        if (format === 'json') {
          expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Version missing could not be found.'}})
          expect(stderr()).toBe('')
        } else {
          expect(stdout()).toBe('')
          expect(unstyled(stderr())).toContain('Version missing could not be found.')
        }
      })
    })
  })

  test('cancelled JSON exits zero through the silent error path', async () => {
    vi.mocked(release).mockResolvedValue({status: 'cancelled'})
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    try {
      await inTemporaryDirectory(async (directory) => {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await runRelease(['--path', directory, '--version', 'v1', '--json', '--allow-updates'])
          expect(exit).toHaveBeenCalledExactlyOnceWith(0)
          expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
          expect(stderr()).toBe('')
        })
      })
    } finally {
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
