import DevClean from './clean.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
import {appDevCleanJsonOutputSchema} from '../../../services/dev-clean/types.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {beforeEach, afterEach, expect, test, vi} from 'vitest'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/store-context.js')

function context() {
  return {
    app: testAppLinked(),
    remoteApp: testOrganizationApp({title: 'Test App', apiKey: 'public-client-id'}),
    developerPlatformClient: testDeveloperPlatformClient({
      devSessionDelete: vi.fn().mockResolvedValue({devSessionDelete: {userErrors: []}}),
    }),
    organization: testOrganization(),
    specifications: [],
    project: testProject(),
    activeConfig: {} as never,
  }
}

beforeEach(() => {
  vi.mocked(linkedAppContext).mockResolvedValue(context())
  vi.mocked(storeContext).mockResolvedValue(testOrganizationStore({shopDomain: 'test-store.myshopify.com'}))
})

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.unstubAllEnvs()
})

async function runCommand(argv: string[]) {
  const command = new DevClean(argv, await Config.load())
  return runWithCommandEventsForCommand(argv, () => command.run())
}

test('writes one encoded public result and keeps diagnostics on stderr', async () => {
  const appContext = context()
  vi.mocked(linkedAppContext).mockImplementation(async () => {
    outputInfo('Using the selected app.')
    return appContext
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(
      runCommand(['--json', '--no-input', '--store', 'HTTPS://TEST-STORE.MYSHOPIFY.COM/admin']),
    ).resolves.toEqual({
      app: appContext.app,
    })
    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      app: {name: 'Test App', clientId: 'public-client-id'},
      storeDomain: 'test-store.myshopify.com',
    })
    expect(stdout()).not.toContain('Dev preview stopped')
    expect(stdout()).not.toContain('apiSecretKeys')
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'info', message: 'Using the selected app.'})
  })
  expect(storeContext).toHaveBeenCalledExactlyOnceWith({
    appContextResult: appContext,
    storeFqdn: 'test-store.myshopify.com',
    forceReselectStore: false,
  })
  expect(appContext.developerPlatformClient.devSessionDelete).toHaveBeenCalledExactlyOnceWith({
    shopFqdn: 'test-store.myshopify.com',
    appId: appContext.remoteApp.id,
  })
})

test.each([{argv: []}, {argv: ['--no-input']}])('keeps text output without selecting JSON: %j', async ({argv}) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand([...argv, '--store', 'test-store'])
    expect(stdout()).toBe('')
    const text = unstyled(stderr()).replace(/│/g, '').replace(/\s+/g, ' ')
    expect(text).toContain('Dev preview stopped.')
    expect(text).toContain("The dev preview has been stopped on test-store.myshopify.com and the app's active version")
    expect(text).toContain('shopify app dev')
  })
})

test('JSON output keeps the existing store selection path', async () => {
  await withCapturedStandardStreams(async ({stdout}) => {
    await runCommand(['--json'])
    expect(JSON.parse(stdout()).status).toBe('success')
  })
  expect(storeContext).toHaveBeenCalledWith(expect.objectContaining({storeFqdn: undefined, forceReselectStore: false}))
})

test.each([
  {response: {devSessionDelete: {userErrors: [{message: 'Preview cannot be stopped', code: 'UPSTREAM_ERROR'}]}}},
  {response: {devSessionDelete: null}},
  {response: {}},
  {response: {devSessionDelete: {userErrors: null}}},
])('prints one fatal envelope and no result for an invalid deletion: %j', async ({response}) => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const appContext = context()
  vi.mocked(appContext.developerPlatformClient.devSessionDelete).mockResolvedValue(response as never)
  vi.mocked(linkedAppContext).mockResolvedValue(appContext)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    try {
      await runCommand(['--json'])
      throw new Error('Expected the deletion to fail')
    } catch (error) {
      if (!(error instanceof AbortError)) throw error
      await handler(error)
    }
    const envelope = JSON.parse(stdout())
    expect(envelope.error.type).toBe('abort')
    expect(envelope.error.message).toContain('Failed to stop the dev preview:')
    const userErrors = response.devSessionDelete?.userErrors
    expect(envelope.error.details).toEqual(userErrors ? {userErrors} : {data: response})
    expect(envelope).not.toHaveProperty('status')
    expect(stderr()).toBe('')
  })
})

test('does not print a result after an API transport failure', async () => {
  const appContext = context()
  vi.mocked(appContext.developerPlatformClient.devSessionDelete).mockRejectedValue(new Error('Network unavailable'))
  vi.mocked(linkedAppContext).mockResolvedValue(appContext)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(runCommand(['--json'])).rejects.toThrow('Network unavailable')
    expect(stdout()).toBe('')
    expect(stderr()).toBe('')
  })
})

test('preserves selection errors before the deletion starts', async () => {
  const appContext = context()
  const error = new AbortError('No store was selected.')
  vi.mocked(linkedAppContext).mockResolvedValue(appContext)
  vi.mocked(storeContext).mockRejectedValue(error)
  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(runCommand(['--json', '--no-input'])).rejects.toBe(error)
    expect(stdout()).toBe('')
  })
  expect(appContext.developerPlatformClient.devSessionDelete).not.toHaveBeenCalled()
})

test.each([{argv: ['--no-input']}, {argv: ['--json', '--no-input']}])(
  'does not prompt when a store selection is required and input is disabled: %j',
  async ({argv}) => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
    const appContext = context()
    vi.mocked(linkedAppContext).mockResolvedValue(appContext)
    vi.mocked(appContext.developerPlatformClient.devStoresForOrg).mockResolvedValue({
      stores: [
        testOrganizationStore({shopId: '1', shopDomain: 'first-store.myshopify.com'}),
        testOrganizationStore({shopId: '2', shopDomain: 'second-store.myshopify.com'}),
      ],
      hasMorePages: false,
    })
    const actual = await vi.importActual<typeof import('../../../services/store-context.js')>(
      '../../../services/store-context.js',
    )
    vi.mocked(storeContext).mockImplementation(actual.storeContext)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(runCommand(argv)).rejects.toBeInstanceOf(AbortError)
      expect(stdout()).toBe('')
      expect(stderr()).toBe('')
    })
    expect(appContext.developerPlatformClient.devSessionDelete).not.toHaveBeenCalled()
  },
)

test('exposes the JSON contract and inherited input flags', () => {
  expect(DevClean.jsonOutputSchema).toBe(appDevCleanJsonOutputSchema)
  expect(DevClean.flags).toHaveProperty('json')
  expect(DevClean.flags).toHaveProperty('no-input')
  expect(DevClean.descriptionForHelp()).toContain('`AppDevCleanResult` schema')
  expect(DevClean.descriptionForHelp()).toContain('AppDevCleanApp')
})
