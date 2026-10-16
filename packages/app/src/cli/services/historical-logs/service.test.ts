import {retrieveLogs} from './service.js'
import {renderHistoricalLogs} from './presenter.js'
import {LogApp} from '../../api/graphql/app-management/generated/log-app.js'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {handler} from '@shopify/cli-kit/node/error'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  fetch: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/api/app-management', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/api/app-management')>()),
  appManagementRequestDoc: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/context/fqdn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/fqdn')>()),
  appManagementFqdn: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/environment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/environment')>()),
  getAppAutomationToken: vi.fn(),
}))

const clientId = 'test-app'
const scope = {'client-id': clientId, 'no-input': true, type: ['webhook']}
const record = {
  id: 'gid://shopify/AppLogRecord/example',
  timestamp: '2026-10-06T13:30:00.123456789Z',
  type: 'WEBHOOK_DELIVERY',
  shopMyshopifyDomain: 'example.myshopify.com',
  topic: 'orders/create',
  resultStatus: 'FAILURE',
  statusCode: 'No response from app',
  responseTimeMs: 6000,
  deliveryAttempt: 2,
  payloadHmac: 'test-signature',
  headers: [{name: 'X-Test', value: 'test-value'}],
  shopId: 'gid://shopify/Shop/123',
  futureField: {nested: [null, false, 'unchanged']},
}

beforeEach(() => {
  vi.useFakeTimers({toFake: ['Date'], now: new Date('2026-10-06T14:00:00Z')})
  vi.stubEnv('SHOPIFY_SERVICE_ENV', 'local')
  vi.mocked(appManagementFqdn).mockResolvedValue('app.shop.dev')
  vi.mocked(getAppAutomationToken).mockReturnValue(undefined)
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValue({
    appManagementToken: 'test-identity-token',
    userId: 'test-user',
    businessPlatformToken: 'test-business-token',
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function respond(body: unknown, status = 200, headers = {}) {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(body), {status, headers}))
}
function authorize() {
  vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
    app: {key: clientId, organizationId: 'gid://shopify/Organization/42'},
  })
}
function logResponse(records: unknown[] = [record]) {
  respond({data: {app: {logs: {records: records.map((json) => ({json}))}}}})
}

test('loads the client ID from the selected local configuration without prompting', async () => {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(joinPath(directory, 'package.json'), '{}')
    await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "other-app"')
    await writeFile(joinPath(directory, 'shopify.app.test.toml'), `client_id = "${clientId}"`)
    authorize()
    logResponse()

    expect((await retrieveLogs({path: directory, config: 'test', 'no-input': true})).logs).toEqual([record])
    expect(appManagementRequestDoc).toHaveBeenCalledWith(expect.objectContaining({variables: {clientId}}))
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: true})
  })
})

test('an explicit client ID takes precedence over local configuration', async () => {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(joinPath(directory, 'package.json'), '{}')
    await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "other-app"')
    authorize()
    logResponse()

    expect((await retrieveLogs({...scope, path: directory})).logs).toEqual([record])
    expect(appManagementRequestDoc).toHaveBeenCalledWith(expect.objectContaining({variables: {clientId}}))
  })
})

test.each(['client_id = ""', 'name = "unlinked-app"', 'client_id = ['])(
  'rejects unusable configuration %s before authentication',
  async (content) => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'package.json'), '{}')
      await writeFile(joinPath(directory, 'shopify.app.toml'), content)

      await expect(retrieveLogs({path: directory, 'no-input': true})).rejects.toThrow()
      expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })
  },
)

test('submits one bounded search and preserves the native record JSON exactly', async () => {
  authorize()
  logResponse()
  const result = await retrieveLogs({...scope, status: 'failure', topic: 'orders/create'})
  expect(result.logs).toEqual([record])
  await withCapturedStandardStreams(async ({stdout}) => {
    renderHistoricalLogs(result, true)
    expect(JSON.parse(stdout()).logs).toEqual([record])
    expect(JSON.parse(stdout())).not.toHaveProperty('query')
    expect(JSON.parse(stdout())).not.toHaveProperty('pageInfo')
    expect(stdout()).not.toContain('test-identity-token')
  })
  expect(result).toMatchObject({
    ordering: 'none',
  })
  expect(appManagementRequestDoc).toHaveBeenCalledExactlyOnceWith({
    query: LogApp,
    token: 'test-identity-token',
    variables: {clientId},
    unauthorizedHandler: {type: 'token_refresh', handler: expect.any(Function)},
  })
  const [url, init] = vi.mocked(fetch).mock.calls[0]!
  expect(url).toBe('https://app.shop.dev/app_logs/unstable/organizations/42/graphql')
  expect(init?.redirect).toBe('error')
  expect(JSON.parse(String(init?.body)).variables).toEqual({
    clientId,
    types: ['WEBHOOK_DELIVERY'],
    timestamp: {gte: '2026-10-06T13:00:00Z', lt: '2026-10-06T14:00:00Z'},
    limit: 20,
    filters: [
      {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'FAILURE'},
      {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
    ],
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: true})
})

test.each(['Admin', 'Storefront', 'CustomerAccount'])(
  'preserves %s GraphQL diagnostics, bodies, and truncation flags',
  async (target) => {
    const graphqlRecord = {
      id: record.id,
      timestamp: record.timestamp,
      type: 'GRAPHQL_REQUEST',
      resultStatus: 'FAILURE',
      shopMyshopifyDomain: null,
      api: target,
      operationName: 'MyQuery',
      requestId: 'request-123',
      requestBody: `query MyQuery { ${'field '.repeat(1000)}`,
      responseBody: '{"errors":[{"message":"example"}]}',
      requestBodyTruncated: true,
      responseBodyTruncated: false,
      errorCodes: ['EXAMPLE'],
      futureDiagnostic: {present: true},
    }
    authorize()
    logResponse([graphqlRecord])
    const result = await retrieveLogs({...scope, type: ['graphql']})
    await withCapturedStandardStreams(async ({stdout}) => {
      renderHistoricalLogs(result, true)
      expect(JSON.parse(stdout()).logs).toEqual([graphqlRecord])
    })
  },
)

test('an empty successful search remains empty without asserting completeness', async () => {
  authorize()
  logResponse([])
  const result = await retrieveLogs(scope)
  expect(result.logs).toEqual([])
  expect(result).not.toHaveProperty('pageInfo')
  expect(result.limitations).toContain(
    'Unordered, capped search; not the newest N records. No pagination or ingestion-completeness guarantee.',
  )
})

test('default mixed-type search shares one query and limit, preserving every predicate', async () => {
  authorize()
  const graphqlRecord = {...record, type: 'GRAPHQL_REQUEST', api: 'storefront'}
  logResponse([record, graphqlRecord])
  const result = await retrieveLogs({'client-id': clientId, limit: 2})
  expect(result.logs).toEqual([record, graphqlRecord])
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).variables).toMatchObject({
    types: ['WEBHOOK_DELIVERY', 'GRAPHQL_REQUEST'],
    limit: 2,
    filters: [],
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('cross-type filters are sent together and an empty intersection is not an error', async () => {
  authorize()
  logResponse([])
  const result = await retrieveLogs({'client-id': clientId, topic: 'orders/create', 'operation-name': 'MyQuery'})
  expect(result.logs).toEqual([])
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).variables).toMatchObject({
    types: ['WEBHOOK_DELIVERY', 'GRAPHQL_REQUEST'],
    filters: [
      {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
      {field: 'OPERATION_NAME', operator: 'EQUALS', value: 'MyQuery'},
    ],
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('a full cap preserves records without inventing pagination metadata', async () => {
  authorize()
  logResponse()
  const result = await retrieveLogs({...scope, limit: 1})
  expect(result.logs).toEqual([record])
  expect(result).not.toHaveProperty('pageInfo')
  expect(result.limitations).toContain(
    'Unordered, capped search; not the newest N records. No pagination or ingestion-completeness guarantee.',
  )
})

test('GraphQL errors preserve native errors, extensions, and partial data as a failure', async () => {
  const data = {app: {logs: {records: [{json: record}]}}}
  const errors = [{message: 'Timed out', path: ['app', 'logs'], extensions: {code: 'THROTTLED', retryAfter: 60}}]
  const extensions = {requestId: 'test-request'}
  authorize()
  respond({data, errors, extensions})
  const failure = await retrieveLogs(scope).catch((error: unknown) => error)
  expect(failure).toMatchObject({code: 'LOG_QUERY_FAILED', details: {data, errors, extensions}})
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await handler(failure)
    expect(JSON.parse(stdout())).toEqual({
      error: {type: 'abort', message: 'Timed out', code: 'LOG_QUERY_FAILED', details: {data, errors, extensions}},
    })
    expect(stderr()).toBe('')
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

test.each(['APP_NOT_ACCESSIBLE', 'THROTTLED', 'INVALID_LOG_QUERY'])(
  'does not turn %s into empty success',
  async (code) => {
    authorize()
    respond({data: {app: null}, errors: [{message: code, extensions: {code}}]})
    await expect(retrieveLogs(scope)).rejects.toMatchObject({
      code: 'LOG_QUERY_FAILED',
      details: {errors: [{extensions: {code}}], data: {app: null}},
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  },
)

test.each([null, {}, {app: null}, {app: {logs: null}}, {app: {logs: {records: null}}}])(
  'rejects invalid log results %j',
  async (data) => {
    authorize()
    respond({data})
    await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'INVALID_RESPONSE'})
  },
)

test.each([
  null,
  'not an object',
  {...record, id: 42},
  {...record, timestamp: null},
  {...record, type: 'GRAPHQL_REQUEST'},
])('rejects invalid or unselected records %j', async (json) => {
  authorize()
  logResponse([json])
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'INVALID_RESPONSE'})
})

test('rejects a response exceeding the requested cap rather than truncating it locally', async () => {
  authorize()
  logResponse([record, {...record, id: 'gid://shopify/AppLogRecord/second'}])
  await expect(retrieveLogs({...scope, limit: 1})).rejects.toMatchObject({code: 'INVALID_RESPONSE'})
})

test.each([
  [401, 'AUTHENTICATION_REQUIRED'],
  [403, 'FORBIDDEN'],
  [429, 'RATE_LIMITED'],
  [504, 'QUERY_TIMEOUT'],
  [500, 'LOGS_API_UNAVAILABLE'],
] as const)('propagates HTTP %s as %s without retries', async (status, code) => {
  authorize()
  respond({}, status, {'retry-after': '60'})
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code, details: {retryAfterSeconds: 60}})
  expect(fetch).toHaveBeenCalledTimes(1)
})

test.each(['app.shopify.com', 'app.shopify.io', 'app.shop.dev'])(
  'uses the standard App Management host %s for logs',
  async (host) => {
    vi.mocked(appManagementFqdn).mockResolvedValue(host)
    authorize()
    logResponse()
    expect((await retrieveLogs(scope)).logs).toEqual([record])
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `https://${host}/app_logs/unstable/organizations/42/graphql`,
      expect.objectContaining({headers: expect.objectContaining({authorization: 'Bearer test-identity-token'})}),
    )
  },
)

test('rejects automation credentials instead of treating them as a user session', async () => {
  vi.mocked(getAppAutomationToken).mockReturnValue('test-automation-token')
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'AUTHENTICATION_REQUIRED'})
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
})

test('does not turn unreadable JSON into an empty result', async () => {
  authorize()
  vi.mocked(fetch).mockResolvedValueOnce(new Response('<html>upstream unavailable</html>', {status: 200}))
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'INVALID_RESPONSE'})
})

test('does not attempt network access when no-input authentication fails', async () => {
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockRejectedValue(new Error('Sign in first'))
  await expect(retrieveLogs(scope)).rejects.toThrow('Sign in first')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: true})
  expect(fetch).not.toHaveBeenCalled()
})

test.each([
  {since: 'bad'},
  {since: '0h'},
  {since: '2026-10-06T14:00:00Z', until: '2026-10-06T13:00:00Z'},
  {until: '2026-10-06T14:00:00.123Z'},
  {limit: 0},
  {'client-id': ''},
  {'operation-name': 'x'.repeat(1025)},
])('rejects invalid local input before auth %j', async (input) => {
  await expect(retrieveLogs({...scope, ...input})).rejects.toMatchObject({code: 'INVALID_ARGUMENT'})
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('reports transport timeouts without returning an empty result', async () => {
  authorize()
  vi.mocked(fetch).mockRejectedValueOnce(Object.assign(new Error('request aborted'), {name: 'TimeoutError'}))
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'QUERY_TIMEOUT'})
  expect(fetch).toHaveBeenCalledTimes(1)
})

test.each(['42', 'gid://shopify/App/42', 'gid://shopify/Organization/42/extra'])(
  'rejects invalid organization identifiers %s',
  async (organizationId) => {
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({app: {key: clientId, organizationId}})
    await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'FORBIDDEN'})
    expect(fetch).not.toHaveBeenCalled()
  },
)

test('rejects an app lookup for another client ID without querying logs', async () => {
  vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
    app: {key: 'other-app', organizationId: 'gid://shopify/Organization/42'},
  })
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'FORBIDDEN'})
  expect(fetch).not.toHaveBeenCalled()
})

test('uses the local clock after app lookup', async () => {
  vi.mocked(appManagementRequestDoc).mockImplementationOnce(async () => {
    vi.setSystemTime(new Date('2026-10-06T14:02:03.987Z'))
    return {app: {key: clientId, organizationId: 'gid://shopify/Organization/42'}}
  })
  logResponse()
  const result = await retrieveLogs(scope)
  expect(result.logs).toEqual([record])
  expect(result.limitations.join(' ')).not.toContain('HTTP Date')
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).variables.timestamp).toEqual({
    gte: '2026-10-06T13:02:03Z',
    lt: '2026-10-06T14:02:03Z',
  })
})

test('uses a token refreshed during app lookup for the log request', async () => {
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValueOnce({
    appManagementToken: 'expired-token',
    businessPlatformToken: 'test-business-token',
    userId: 'test-user',
  })
  vi.mocked(appManagementRequestDoc).mockImplementationOnce(async ({unauthorizedHandler}) => {
    await expect(unauthorizedHandler.handler()).resolves.toEqual({token: 'test-identity-token'})
    return {app: {key: clientId, organizationId: 'gid://shopify/Organization/42'}}
  })
  logResponse()
  expect((await retrieveLogs(scope)).logs).toEqual([record])
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenLastCalledWith({
    noPrompt: true,
    forceRefresh: true,
  })
  expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({authorization: 'Bearer test-identity-token'})
})

test('propagates app lookup failures without querying logs', async () => {
  const failure = new Error('App lookup denied')
  vi.mocked(appManagementRequestDoc).mockRejectedValueOnce(failure)
  await expect(retrieveLogs(scope)).rejects.toBe(failure)
  expect(fetch).not.toHaveBeenCalled()
})

test.each([
  [{since: '8d'}, 'The timestamp range must not exceed 7 days.'],
  [{since: '2026-09-01T12:00:00Z', until: '2026-09-01T13:00:00Z'}, 'timestamp.gte must be within the last 30 days.'],
  [{until: '2026-10-06T14:02:00Z'}, 'timestamp.lt must not be more than 1 minute in the future.'],
])('surfaces backend time-policy errors for %j without retrying', async (input, message) => {
  authorize()
  const errors = [{message, path: ['app', 'logs'], extensions: {code: 'INVALID_LOG_QUERY'}}]
  respond({errors})
  const failure = await retrieveLogs({...scope, ...input}).catch((error: unknown) => error)
  expect(failure).toMatchObject({message, code: 'LOG_QUERY_FAILED', details: {errors}})
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await handler(failure)
    expect(stdout()).toBe('')
    expect(stderr()).toContain(message)
  })
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await handler(failure)
    expect(JSON.parse(stdout())).toEqual({
      error: {type: 'abort', message, code: 'LOG_QUERY_FAILED', details: {errors}},
    })
    expect(stderr()).toBe('')
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('renders CLI-owned validation codes at error.code without upstream details', async () => {
  const failure = await retrieveLogs({...scope, since: '0h'}).catch((error: unknown) => error)
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await handler(failure)
    expect(JSON.parse(stdout())).toEqual({
      error: {
        type: 'abort',
        message: '--since requires a positive integer duration or a whole-second timestamp.',
        code: 'INVALID_ARGUMENT',
      },
    })
    expect(stderr()).toBe('')
  })
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})
