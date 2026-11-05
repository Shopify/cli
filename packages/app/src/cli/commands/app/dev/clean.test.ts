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
import {expect, vi} from 'vitest'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/store-context.js')

let client: ReturnType<typeof testDeveloperPlatformClient>
const userErrors = [{message: 'Preview cannot be stopped', code: 'UPSTREAM_ERROR'}]

describeJsonCommand({
  command: DevClean,
  commandId: 'app:dev:clean',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: {
    status: 'success',
    app: {name: 'Test App', clientId: 'public-client-id'},
    storeDomain: 'test-store.myshopify.com',
  },
  expectedSchema: {type: 'object', required: ['status', 'app', 'storeDomain'], additionalProperties: false},
  setup: () => {
    client = testDeveloperPlatformClient({
      devSessionDelete: vi.fn().mockResolvedValue({devSessionDelete: {userErrors: []}}),
    })
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp: testOrganizationApp({title: 'Test App', apiKey: 'public-client-id'}),
      developerPlatformClient: client,
      organization: testOrganization(),
      specifications: [],
      project: testProject(),
      activeConfig: {} as never,
    })
    vi.mocked(storeContext).mockResolvedValue(testOrganizationStore({shopDomain: 'test-store.myshopify.com'}))
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledOnce()
    expect(storeContext).toHaveBeenCalledOnce()
    expect(client.devSessionDelete).toHaveBeenCalledExactlyOnceWith({shopFqdn: 'test-store.myshopify.com', appId: '1'})
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(storeContext).not.toHaveBeenCalled()
    expect(client.devSessionDelete).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Dev preview stopped.')
    expect(stderr).toContain('test-store.myshopify.com')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(linkedAppContext).mockImplementationOnce(async (options) => {
        outputInfo('Using the selected app.')
        return vi.mocked(linkedAppContext).getMockImplementation()!(options)
      })
    },
    expectedEvents: [{type: 'diagnostic', message: 'Using the selected app.'}],
  },
  failure: {
    setup: () => {
      vi.mocked(client.devSessionDelete).mockResolvedValue({devSessionDelete: {userErrors}})
    },
    expectedError: {
      error: {
        type: 'abort',
        message: 'Failed to stop the dev preview: Preview cannot be stopped',
        details: {userErrors},
      },
    },
    exitCode: 1,
  },
})
