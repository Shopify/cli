import DevClean from './clean.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
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
import {handler} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/store-context.js')

afterEach(() => vi.unstubAllEnvs())

async function runCommand(response: unknown = {devSessionDelete: {userErrors: []}}, diagnostic = false) {
  const appContext = {
    app: testAppLinked(),
    remoteApp: testOrganizationApp({title: 'Test App', apiKey: 'public-client-id'}),
    developerPlatformClient: testDeveloperPlatformClient({devSessionDelete: vi.fn().mockResolvedValue(response)}),
    organization: testOrganization(),
    specifications: [],
    project: testProject(),
    activeConfig: {} as never,
  }
  vi.mocked(linkedAppContext).mockImplementation(async () => {
    if (diagnostic) outputInfo('Using the selected app.')
    return appContext
  })
  vi.mocked(storeContext).mockResolvedValue(testOrganizationStore({shopDomain: 'test-store.myshopify.com'}))
  const command = new DevClean(['--json'], await Config.load())
  return runWithCommandEventsForCommand(['--json'], () => command.run())
}

test('writes one public JSON result with diagnostics on stderr', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(undefined, true)
    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      app: {name: 'Test App', clientId: 'public-client-id'},
      storeDomain: 'test-store.myshopify.com',
    })
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Using the selected app.'})
  })
})

test('writes one fatal JSON document when deletion returns user errors', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const userErrors = [{message: 'Preview cannot be stopped', code: 'UPSTREAM_ERROR'}]
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand({devSessionDelete: {userErrors}}).catch(handler)
    expect(JSON.parse(stdout())).toEqual({
      error: {
        type: 'abort',
        message: 'Failed to stop the dev preview: Preview cannot be stopped',
        details: {userErrors},
      },
    })
    expect(stderr()).toBe('')
  })
})
