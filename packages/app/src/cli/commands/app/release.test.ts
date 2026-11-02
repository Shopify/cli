import Release from './release.js'
import {release} from '../../services/release.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../models/app/app.test-data.js'
import {AppManagementClient} from '../../utilities/developer-platform-client/app-management-client.js'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {graphqlRequestDoc} from '@shopify/cli-kit/node/api/graphql'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderError} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
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
vi.mock('@shopify/cli-kit/node/analytics')

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
    // Vitest's throwing process.exit makes Oclif print error stacks to the captured native console.
    vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
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

  test('release rejection uses one shared error document', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    const userErrors = [{message: 'Release failed.', category: 'validation', details: [], field: ['version']}]
    vi.mocked(release).mockResolvedValue({status: 'failed', version, userErrors})
    await inTemporaryDirectory(async (tmp) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(
          runRelease(['--path', tmp, '--version', 'v1', '--json', '--allow-updates']),
        ).resolves.toBeUndefined()
        expect(process.exit).toHaveBeenCalledExactlyOnceWith(1)
        expect(JSON.parse(stdout())).toMatchObject({
          error: {type: 'abort', message: "Version couldn't be released.", details: {userErrors}},
        })
        expect(stderr()).toBe('')
      })
    })
  })

  test.each(['json', 'text'])('missing version retains the %s error output', async (format) => {
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
        await expect(runRelease(argv)).resolves.toBeUndefined()
        expect(process.exit).toHaveBeenCalledExactlyOnceWith(1)
        expect(reportAnalyticsEvent).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            errorMessage: format === 'json' ? 'Version missing could not be found.' : "Version couldn't be released.",
            exitMode: 'expected_error',
          }),
        )
        expect(rawRequest).toHaveBeenCalledWith(expect.stringContaining('versionByTag(appId: $appId'), {
          appId: testOrganizationApp().id,
          versionTag: 'missing',
        })
        if (format === 'json') {
          expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Version missing could not be found.'}})
          expect(stderr()).toBe('')
        } else {
          expect(stdout()).toBe('')
          const actualBanner = stderr()
          await withCapturedStandardStreams(async ({stderr: expectedStderr}) => {
            renderError({
              headline: "Version couldn't be released.",
              body: ['Version', {userInput: 'missing'}, 'could not be found.'],
            })
            expect(actualBanner).toBe(expectedStderr())
          })
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
        ).resolves.toBeUndefined()
        expect(process.exit).toHaveBeenCalledExactlyOnceWith(1)
        const {error} = JSON.parse(stdout())
        expect(error).toMatchObject({type: 'abort', message: expect.stringContaining(message)})
        expect(error.message).toContain('Request ID: lookup-request-id')
        if (status === 403) expect(error.tryMessage).toContain('shopify auth login')
        expect(stderr()).toBe('')
        expect(releaseRequest).not.toHaveBeenCalled()
      })
    })
  })

  test('cancelled JSON runs postrun without an explicit exit', async () => {
    vi.mocked(release).mockResolvedValue({status: 'cancelled'})
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    try {
      await inTemporaryDirectory(async (directory) => {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          const config = await releaseConfig()
          const metadata = config.findCommand('app:release')!
          vi.spyOn(config, 'findCommand').mockReturnValue({...metadata, id: 'app:release', load: async () => Release})
          const hooks = vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], failures: []})
          const argv = ['--path', directory, '--version', 'v1', '--json', '--allow-updates']
          const result = await config.runCommand('app:release', argv)
          expect(result).toEqual({app: testAppLinked()})
          expect(hooks).toHaveBeenCalledWith('postrun', {argv, Command: Release, result})
          expect(exit).not.toHaveBeenCalled()
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
  return Release.run(argv, await releaseConfig())
}

async function releaseConfig() {
  const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
  // The source package is bundled in the installed CLI, not a custom plugin.
  config.plugins.delete('@shopify/app')
  return config
}

describeJsonCommand({
  command: Release,
  commandId: 'app:release',
  moduleURL: new URL('../../../../../cli/bin/dev.js', import.meta.url).href,
  args: ['--version', 'v1', '--allow-updates'],
  expectedResult: {
    status: 'success',
    app: {name: 'app1', clientId: 'api-key'},
    release: {version: {gid: version.uuid, name: 'v1', message: 'Release message', url: version.location}},
  },
  expectedSchema: {
    anyOf: [
      {
        type: 'object',
        properties: {app: {$ref: '#/definitions/App'}, release: {$ref: '#/definitions/AppRelease'}},
        required: ['status', 'app', 'release'],
        additionalProperties: false,
      },
      {type: 'object', required: ['status'], additionalProperties: false},
    ],
  },
  setup: () => {
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
    } as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(release).mockResolvedValue({status: 'success', version})
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({version: 'v1', allowUpdates: true, force: false}),
    )
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(release).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Version released to users.')
    expect(stderr).toContain('Release message')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(release).mockImplementation(async () => {
        outputInfo('Releasing an app version')
        return {status: 'success', version}
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Releasing an app version'}],
  },
  failure: {
    setup: () => {
      vi.mocked(release).mockRejectedValue(new AbortError('Release failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Release failed.'}},
    exitCode: 1,
  },
})
