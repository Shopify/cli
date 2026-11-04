import DevPush from './push.js'
import {commands} from '../../../index.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
import {devPush} from '../../../services/dev-push.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {handler, AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/store-context.js')
vi.mock('../../../services/dev-push.js')

afterEach(() => vi.unstubAllEnvs())

test('registers the command in the app command index', () => {
  expect(commands['app:dev:push']).toBe(DevPush)
})

const result = {
  status: 'success' as const,
  app: {name: 'Test app', clientId: 'public-client-id'},
  storeDomain: 'test-store.myshopify.com',
  appUrl: 'https://preview.example.com',
  previewUrl: 'https://admin.shopify.com/store/test-store/apps/public-client-id',
  warnings: [],
}

async function runCommand(args: string[], failure?: Error) {
  const appContextResult = {
    app: testAppLinked(),
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
    organization: testOrganization(),
    specifications: [],
    project: testProject(),
    activeConfig: {} as never,
  }
  vi.mocked(linkedAppContext).mockImplementation(async () => {
    outputInfo('Using the selected app.')
    return appContextResult
  })
  vi.mocked(storeContext).mockResolvedValue(testOrganizationStore({shopDomain: result.storeDomain}))
  if (failure) vi.mocked(devPush).mockRejectedValue(failure)
  else vi.mocked(devPush).mockResolvedValue(result)
  const command = new DevPush(args, await Config.load())
  await runWithCommandEventsForCommand(args, () => command.run())
  return appContextResult
}

test('passes a normalized URL and the selected store without requiring user store access', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    const appContextResult = await runCommand([
      '--config',
      'preview',
      '--client-id',
      'another-app',
      '--store',
      'test-store',
      '--url',
      'https://preview.example.com/',
      '--json',
      '--no-input',
    ])
    expect(linkedAppContext).toHaveBeenCalledWith(
      expect.objectContaining({
        userProvidedConfigName: 'preview',
        clientId: 'another-app',
      }),
    )
    expect(storeContext).toHaveBeenCalledWith({
      appContextResult,
      storeFqdn: 'test-store.myshopify.com',
      forceReselectStore: false,
      ensureUserAccess: false,
    })
    expect(devPush).toHaveBeenCalledWith({
      appContextResult,
      store: expect.objectContaining({shopDomain: 'test-store.myshopify.com'}),
      url: 'https://preview.example.com',
      skipDependenciesInstallation: false,
    })
    expect(JSON.parse(stdout())).toEqual(result)
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Using the selected app.'})
  })
})

test('leaves URL rewriting disabled when --url is omitted', async () => {
  await withCapturedStandardStreams(async () => {
    await runCommand(['--store', 'test-store', '--json'])
    expect(devPush).toHaveBeenCalledWith(expect.objectContaining({url: undefined}))
  })
})

test('passes --skip-dependencies-installation to the push', async () => {
  await withCapturedStandardStreams(async () => {
    await runCommand(['--store', 'test-store', '--skip-dependencies-installation', '--json'])
    expect(devPush).toHaveBeenCalledWith(expect.objectContaining({skipDependenciesInstallation: true}))
  })
})

test('accepts the URL environment variable through command parsing', async () => {
  vi.stubEnv('SHOPIFY_FLAG_URL', 'https://preview.example.com:8443/')
  await withCapturedStandardStreams(async () => {
    await runCommand(['--store', 'test-store', '--json'])
    expect(devPush).toHaveBeenCalledWith(expect.objectContaining({url: 'https://preview.example.com:8443'}))
  })
})

test.each([
  'http://preview.example.com',
  'not-a-url',
  'https://user:secret@preview.example.com',
  'https://preview.example.com/path',
  'https://preview.example.com/?token=secret',
  'https://preview.example.com/#fragment',
])('rejects an invalid base URL before authenticating: %s', async (url) => {
  await expect(runCommand(['--url', url, '--json'])).rejects.toThrow('must be an HTTPS origin')
  expect(linkedAppContext).not.toHaveBeenCalled()
  expect(storeContext).not.toHaveBeenCalled()
  expect(devPush).not.toHaveBeenCalled()
})

test('writes one fatal JSON result when preview creation fails', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withCapturedStandardStreams(async ({stdout}) => {
    await runCommand(['--json'], new AbortError('Preview could not be created')).catch(handler)
    expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Preview could not be created'}})
  })
})

test('does not treat a silently failed build as a successful push', async () => {
  await withCapturedStandardStreams(async () => {
    await expect(runCommand(['--json'], new AbortSilentError())).rejects.toThrow(
      'The dev preview push did not complete',
    )
  })
})
