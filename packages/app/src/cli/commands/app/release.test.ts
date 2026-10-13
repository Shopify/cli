import Release from './release.js'
import {release} from '../../services/release.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../models/app/app.test-data.js'
import {AppManagementClient} from '../../utilities/developer-platform-client/app-management-client.js'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {graphqlRequestDoc} from '@shopify/cli-kit/node/api/graphql'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {Config} from '@oclif/core'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {ClientError} from 'graphql-request'
import {GraphQLError} from 'graphql'
import {fileURLToPath} from 'node:url'

const {rawRequest} = vi.hoisted(() => ({rawRequest: vi.fn()}))

vi.mock('graphql-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('graphql-request')>()),
  GraphQLClient: class {
    requestConfig = {}
    rawRequest = rawRequest
  },
}))

vi.mock('../../services/release.js')
vi.mock('../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/api/app-management')

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
  AppManagementClient.resetInstance()
})

describe('app release command', () => {
  beforeEach(() => {
    vi.mocked(appManagementRequestDoc).mockImplementation((options) =>
      graphqlRequestDoc({
        ...options,
        api: 'App Management',
        url: 'https://app-management.example/graphql',
        preferredBehaviour: 'non-blocking',
      }),
    )
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
    const client = AppManagementClient.getInstance()
    client.token = () => Promise.resolve('token')
    rawRequest.mockRejectedValueOnce(
      new ClientError(
        {
          status: 200,
          headers: new Headers(),
          errors: [
            new GraphQLError('Query errors', {
              path: ['versionByTag'],
              extensions: {app_errors: {errors: [{category: 'not_found', message: 'The entity could not be found.'}]}},
            }),
          ],
        },
        {query: 'query AppVersionByTag { versionByTag { id } }'},
      ),
    )
    vi.mocked(linkedAppContext).mockResolvedValueOnce({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
      developerPlatformClient: client,
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    await inTemporaryDirectory(async (directory) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const argv = ['--path', directory, '--version', 'missing', '--allow-updates']
        if (format === 'json') argv.push('--json')
        await expect(runRelease(argv)).rejects.toThrow()
        expect(rawRequest).toHaveBeenCalledWith(expect.stringContaining('versionByTag(appId: $appId'), {
          appId: testOrganizationApp().id,
          versionTag: 'missing',
        })
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

  test.each([
    {status: 503, message: 'Service unavailable'},
    {status: 403, message: 'Access denied'},
    {status: 404, message: 'Cannot find a valid organization'},
  ])('preserves the lookup failure in JSON: HTTP $status', async ({status, message}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    const {release: releaseService} =
      await vi.importActual<typeof import('../../services/release.js')>('../../services/release.js')
    vi.mocked(release).mockImplementationOnce(releaseService)
    const client = AppManagementClient.getInstance()
    client.token = () => Promise.resolve('token')
    const releaseRequest = vi.spyOn(client, 'release')
    rawRequest.mockRejectedValueOnce(
      new ClientError(
        {status, headers: new Headers({'x-request-id': 'lookup-request-id'}), errors: [new GraphQLError(message)]},
        {query: 'query AppVersionByTag { versionByTag { id } }'},
      ),
    )
    vi.mocked(linkedAppContext).mockResolvedValueOnce({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
      developerPlatformClient: client,
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    await inTemporaryDirectory(async (directory) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(
          runRelease([
            '--path',
            directory,
            '--version',
            'v1',
            '--json',
            '--allow-updates',
            '--allow-deletes',
            '--no-input',
          ]),
        ).rejects.toThrow()
        const {error} = JSON.parse(stdout())
        expect(error).toMatchObject({type: 'abort', message: expect.stringContaining(message)})
        expect(error.message).toContain('Request ID: lookup-request-id')
        if (status === 403) expect(error.tryMessage).toContain('shopify auth login')
        expect(stderr()).toBe('')
        expect(releaseRequest).not.toHaveBeenCalled()
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
