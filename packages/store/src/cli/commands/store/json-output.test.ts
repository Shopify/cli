import StoreAuth from './auth.js'
import StoreStripeAuth from './stripe-auth.js'
import StoreAuthList from './auth/list.js'
import StoreExecute from './execute.js'
import StoreInfo from './info.js'
import StoreList from './list.js'
import StoreOpen from './open.js'
import StoreCreatePreview from './create/preview.js'
import StoreBulkExecute from './bulk/execute.js'
import StoreBulkStatus from './bulk/status.js'
import StoreBulkCancel from './bulk/cancel.js'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {listStoreAuthSessions} from '../../services/store/auth/list.js'
import {executeStoreOperation} from '../../services/store/execute/index.js'
import {getStoreInfo} from '../../services/store/info/index.js'
import {listStores} from '../../services/store/list.js'
import {openStore} from '../../services/store/open.js'
import {createPreviewStoreCommand} from '../../services/store/create/preview/index.js'
import {executeBulkOperation, prepareBulkOperation} from '../../services/store/bulk/execute-bulk-operation.js'
import {prepareBulkAdminContext} from '../../services/store/bulk/bulk-admin-context.js'
import {listBulkOperations} from '../../services/store/bulk/bulk-operation-status.js'
import {cancelBulkOperation} from '../../services/store/bulk/cancel-bulk-operation.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'

vi.mock('../../services/store/auth/index.js')
vi.mock('../../services/store/auth/list.js')
vi.mock('../../services/store/execute/index.js')
vi.mock('../../services/store/info/index.js')
vi.mock('../../services/store/list.js')
vi.mock('../../services/store/open.js')
vi.mock('../../services/store/create/preview/index.js')
vi.mock('../../services/store/bulk/execute-bulk-operation.js')
vi.mock('../../services/store/bulk/bulk-admin-context.js')
vi.mock('../../services/store/bulk/bulk-operation-status.js')
vi.mock('../../services/store/bulk/cancel-bulk-operation.js')

const store = 'shop.myshopify.com'
const adminSession = {token: 'token', storeFqdn: store}
const authResult = {
  store,
  userId: '42',
  scopes: ['read_products'],
  acquiredAt: '2026-10-13T10:00:00Z',
  hasRefreshToken: false,
  associatedUser: {id: 42, email: 'merchant@example.com'},
}

for (const {command, commandId, signup} of [
  {command: StoreAuth, commandId: 'store:auth'},
  {command: StoreStripeAuth, commandId: 'store:stripe-auth', signup: 'signed.signup.jwt'},
]) {
  describeJsonCommand({
    command,
    commandId,
    moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
    args: ['--store', store, '--scopes', 'read_products', ...(signup ? ['--signup', signup] : [])],
    expectedResult: authResult,
    expectedSchema: {type: 'object', required: ['store', 'userId', 'scopes', 'acquiredAt', 'hasRefreshToken']},
    setup: () => {
      vi.mocked(authenticateStoreWithApp).mockImplementation(async (_input, {presenter} = {}) => {
        presenter!.success(authResult)
        return authResult
      })
    },
    assertExecuted: () => {
      expect(authenticateStoreWithApp).toHaveBeenCalledExactlyOnceWith(
        {store, scopes: 'read_products', ...(signup ? {signup} : {})},
        {presenter: expect.objectContaining({success: expect.any(Function)})},
      )
    },
    assertNotExecuted: () => expect(authenticateStoreWithApp).not.toHaveBeenCalled(),
    textOutput: {
      stdout: '',
      stderr:
        '✔ Logged in.\n✔ Authenticated as merchant@example.com against shop.myshopify.com.\n\n' +
        'To verify that authentication worked, run:\n' +
        "shopify store execute --store shop.myshopify.com --query 'query { shop { name id } }'\n",
    },
    failure: {
      setup: () => {
        vi.mocked(authenticateStoreWithApp).mockRejectedValue(new AbortError('Authentication failed.'))
      },
      expectedError: {error: {type: 'abort', message: 'Authentication failed.'}},
      exitCode: 1,
    },
  })
}

describeJsonCommand({
  command: StoreAuthList,
  commandId: 'store:auth:list',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: [],
  expectedResult: {sessions: [], message: 'No stores.'},
  expectedSchema: {type: 'object', properties: {sessions: {type: 'array'}}, required: ['sessions']},
  setup: () => {
    vi.mocked(listStoreAuthSessions).mockReturnValue({sessions: [], message: 'No stores.'})
  },
  assertExecuted: () => expect(listStoreAuthSessions).toHaveBeenCalledExactlyOnceWith(),
  assertNotExecuted: () => expect(listStoreAuthSessions).not.toHaveBeenCalled(),
  textOutput: {stdout: '', stderr: 'No stores.\n'},
  failure: {
    setup: () => {
      vi.mocked(listStoreAuthSessions).mockImplementation(() => {
        throw new AbortError('Cannot read stored sessions.')
      })
    },
    expectedError: {error: {type: 'abort', message: 'Cannot read stored sessions.'}},
    exitCode: 1,
  },
})

const executeResult = {data: {shop: {name: 'Test shop'}}}
describeJsonCommand({
  command: StoreExecute,
  commandId: 'store:execute',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store, '--query', 'query { shop { name } }'],
  expectedResult: executeResult,
  expectedSchema: {anyOf: [{type: 'object', additionalProperties: {}}, {type: 'null'}]},
  setup: () => {
    vi.mocked(executeStoreOperation).mockResolvedValue(executeResult)
  },
  assertExecuted: () => {
    expect(executeStoreOperation).toHaveBeenCalledExactlyOnceWith({
      store,
      query: 'query { shop { name } }',
      queryFile: undefined,
      variables: undefined,
      variableFile: undefined,
      version: undefined,
      allowMutations: false,
    })
  },
  assertNotExecuted: () => expect(executeStoreOperation).not.toHaveBeenCalled(),
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe(`${JSON.stringify(executeResult, null, 2)}\n`)
    expect(stderr).toContain('Operation succeeded.')
  },
  failure: {
    setup: () => {
      vi.mocked(executeStoreOperation).mockRejectedValue(new AbortError('GraphQL request failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'GraphQL request failed.'}},
    exitCode: 1,
  },
})

describeJsonCommand({
  command: StoreInfo,
  commandId: 'store:info',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store],
  expectedResult: {displayName: 'My Shop', subdomain: store},
  expectedSchema: {type: 'object', properties: {subdomain: {type: 'string'}}, required: ['subdomain']},
  setup: () => {
    vi.mocked(getStoreInfo).mockResolvedValue({displayName: 'My Shop', subdomain: store})
  },
  assertExecuted: () => expect(getStoreInfo).toHaveBeenCalledExactlyOnceWith({store}),
  assertNotExecuted: () => expect(getStoreInfo).not.toHaveBeenCalled(),
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Store details')
    expect(stderr).toContain('My Shop')
    expect(stderr).toContain(store)
  },
  failure: {
    setup: () => {
      vi.mocked(getStoreInfo).mockRejectedValue(new AbortError('Cannot find store.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot find store.'}},
    exitCode: 1,
  },
})

describeJsonCommand({
  command: StoreList,
  commandId: 'store:list',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: [],
  expectedResult: {stores: []},
  expectedSchema: {type: 'object', properties: {stores: {type: 'array'}}, required: ['stores']},
  setup: () => {
    vi.mocked(listStores).mockResolvedValue({stores: []})
  },
  assertExecuted: () =>
    expect(listStores).toHaveBeenCalledExactlyOnceWith({organizationId: undefined, storeType: undefined}),
  assertNotExecuted: () => expect(listStores).not.toHaveBeenCalled(),
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('No stores found.')
    expect(stderr).toContain('shopify store auth list')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(listStores).mockImplementation(async () => {
        outputWarn('Store listing diagnostic')
        return {stores: []}
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'warning', message: 'Store listing diagnostic'}],
  },
  failure: {
    setup: () => {
      vi.mocked(listStores).mockRejectedValue(new AbortError('Cannot list stores.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot list stores.'}},
    exitCode: 1,
  },
})

const openResult = {storeDomain: store, url: `https://${store}`, opened: false}
describeJsonCommand({
  command: StoreOpen,
  commandId: 'store:open',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store],
  expectedResult: openResult,
  expectedSchema: {type: 'object', required: ['storeDomain', 'url', 'opened'], additionalProperties: false},
  setup: () => {
    vi.mocked(openStore).mockResolvedValue(openResult)
  },
  assertExecuted: () => expect(openStore).toHaveBeenCalledExactlyOnceWith({store}),
  assertNotExecuted: () => expect(openStore).not.toHaveBeenCalled(),
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("Browser didn't open automatically. Open the storefront manually:")
    expect(stderr).toContain(openResult.url)
  },
  failure: {
    setup: () => {
      vi.mocked(openStore).mockRejectedValue(new AbortError('Store unavailable.'))
    },
    expectedError: {error: {type: 'abort', message: 'Store unavailable.'}},
    exitCode: 1,
  },
})

const previewResult = {
  status: 'success' as const,
  message: 'Your Shopify store is ready.',
  store: {id: '123', name: 'Lavender Candles', subdomain: store, country: 'US', storefrontUrl: `https://${store}`},
  next_steps: ['Use `shopify store open` to preview the storefront.'],
}
describeJsonCommand({
  command: StoreCreatePreview,
  commandId: 'store:create:preview',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--name', 'Lavender Candles', '--country', 'us'],
  expectedResult: previewResult,
  expectedEvents: [
    {type: 'progress', status: 'started', message: 'Creating store'},
    {type: 'progress', status: 'completed', message: 'Creating store'},
  ],
  expectedSchema: {type: 'object', required: ['status', 'message', 'store', 'next_steps']},
  setup: () => {
    vi.mocked(createPreviewStoreCommand).mockResolvedValue(previewResult)
  },
  assertExecuted: () =>
    expect(createPreviewStoreCommand).toHaveBeenCalledExactlyOnceWith({name: 'Lavender Candles', country: 'US'}),
  assertNotExecuted: () => expect(createPreviewStoreCommand).not.toHaveBeenCalled(),
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Store created')
    expect(stderr).toContain(previewResult.message)
    expect(stderr).toContain('shopify store open')
  },
  failure: {
    setup: () => {
      vi.mocked(createPreviewStoreCommand).mockRejectedValue(new AbortError('Cannot create preview store.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot create preview store.'}},
    expectedEvents: [
      {type: 'progress', status: 'started', message: 'Creating store'},
      {type: 'progress', status: 'failed', message: 'Creating store'},
    ],
    exitCode: 1,
  },
})

const operation = {
  id: 'gid://shopify/BulkOperation/123',
  type: 'QUERY',
  status: 'RUNNING',
  createdAt: '2026-10-13T10:00:00Z',
  objectCount: '0',
}
const expectedOperation = {
  gid: operation.id,
  type: 'QUERY',
  status: 'RUNNING',
  errorCode: null,
  createdAt: '2026-10-13T10:00:00Z',
  completedAt: null,
  objectCount: '0',
  url: null,
  partialDataUrl: null,
}

describeJsonCommand({
  command: StoreBulkExecute,
  commandId: 'store:bulk:execute',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store, '--query', '{ shop { id } }'],
  expectedResult: {storeDomain: store, apiVersion: '2026-01', status: 'success', operation: expectedOperation},
  expectedEvents: [{type: 'diagnostic', level: 'info', message: expect.stringContaining('Starting bulk operation.')}],
  expectedSchema: {
    anyOf: [
      {properties: {status: {enum: ['success', 'partial', 'cancelled']}}},
      {properties: {format: {const: 'jsonl'}}},
    ],
  },
  setup: () => {
    vi.mocked(prepareBulkOperation).mockResolvedValue({
      adminSession,
      version: '2026-01',
      query: '{ shop { id } }',
      variablesJsonl: undefined,
      watch: false,
    })
    vi.mocked(executeBulkOperation).mockResolvedValue({
      store,
      apiVersion: '2026-01',
      operation,
      userErrors: [],
      watchAborted: false,
    })
  },
  assertExecuted: () => {
    expect(prepareBulkOperation).toHaveBeenCalledExactlyOnceWith({
      store,
      query: '{ shop { id } }',
      variables: undefined,
      variableFile: undefined,
      watch: false,
      allowMutations: false,
    })
    expect(executeBulkOperation).toHaveBeenCalledExactlyOnceWith({
      adminSession,
      version: '2026-01',
      query: '{ shop { id } }',
      variablesJsonl: undefined,
      watch: false,
    })
  },
  assertNotExecuted: () => {
    expect(prepareBulkOperation).not.toHaveBeenCalled()
    expect(executeBulkOperation).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Starting bulk operation.')
    expect(stderr).toContain('Bulk operation is running.')
    expect(stderr).toContain('shopify store bulk status --id=123')
  },
  failure: {
    setup: () => {
      vi.mocked(executeBulkOperation).mockRejectedValue(new AbortError('Cannot start bulk operation.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot start bulk operation.'}},
    expectedEvents: [{type: 'diagnostic', level: 'info', message: expect.stringContaining('Starting bulk operation.')}],
    exitCode: 1,
  },
})

describeJsonCommand({
  command: StoreBulkStatus,
  commandId: 'store:bulk:status',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store],
  expectedResult: {storeDomain: store, apiVersion: '2026-01', operations: [], pageInfo: {hasNextPage: false}},
  expectedEvents: [{type: 'diagnostic', level: 'info', message: expect.stringContaining('Listing bulk operations.')}],
  expectedSchema: {
    anyOf: [
      {required: ['storeDomain', 'apiVersion', 'operationGid', 'operation']},
      {required: ['storeDomain', 'apiVersion', 'operations', 'pageInfo']},
    ],
  },
  setup: () => {
    vi.mocked(prepareBulkAdminContext).mockResolvedValue(adminSession)
    vi.mocked(listBulkOperations).mockResolvedValue({store, apiVersion: '2026-01', operations: []})
  },
  assertExecuted: () => {
    expect(prepareBulkAdminContext).toHaveBeenCalledExactlyOnceWith(store)
    expect(listBulkOperations).toHaveBeenCalledExactlyOnceWith({adminSession})
  },
  assertNotExecuted: () => {
    expect(prepareBulkAdminContext).not.toHaveBeenCalled()
    expect(listBulkOperations).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Listing bulk operations.')
    expect(stderr).toContain('No bulk operations found in the last 7 days.')
  },
  failure: {
    setup: () => {
      vi.mocked(listBulkOperations).mockRejectedValue(new AbortError('Cannot list bulk operations.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot list bulk operations.'}},
    expectedEvents: [{type: 'diagnostic', level: 'info', message: expect.stringContaining('Listing bulk operations.')}],
    exitCode: 1,
  },
})

describeJsonCommand({
  command: StoreBulkCancel,
  commandId: 'store:bulk:cancel',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store, '--id', '123'],
  expectedResult: {
    storeDomain: store,
    apiVersion: '2026-01',
    status: 'success',
    operation: {...expectedOperation, status: 'CANCELING'},
  },
  expectedEvents: [{type: 'diagnostic', level: 'info', message: expect.stringContaining('Canceling bulk operation.')}],
  expectedSchema: {
    type: 'object',
    required: ['storeDomain', 'apiVersion', 'status', 'operation'],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(prepareBulkAdminContext).mockResolvedValue(adminSession)
    vi.mocked(cancelBulkOperation).mockResolvedValue({
      store,
      apiVersion: '2026-01',
      operation: {...operation, status: 'CANCELING'},
      userErrors: [],
    })
  },
  assertExecuted: () => {
    expect(prepareBulkAdminContext).toHaveBeenCalledExactlyOnceWith(store)
    expect(cancelBulkOperation).toHaveBeenCalledExactlyOnceWith({adminSession, operationId: operation.id})
  },
  assertNotExecuted: () => {
    expect(prepareBulkAdminContext).not.toHaveBeenCalled()
    expect(cancelBulkOperation).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Canceling bulk operation.')
    expect(stderr).toContain('shopify store bulk status --id=123')
  },
  failure: {
    setup: () => {
      vi.mocked(cancelBulkOperation).mockRejectedValue(new AbortError('Cannot cancel bulk operation.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot cancel bulk operation.'}},
    expectedEvents: [
      {type: 'diagnostic', level: 'info', message: expect.stringContaining('Canceling bulk operation.')},
    ],
    exitCode: 1,
  },
})
