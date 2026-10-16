import {retrieveLogs} from './service.js'
import {renderHistoricalLogs} from './presenter.js'
import {LogApp} from '../../api/graphql/app-management/generated/log-app.js'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {shopifyFetch, Response, FetchError} from '@shopify/cli-kit/node/http'
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
  shopifyFetch: vi.fn(),
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
  vi.mocked(shopifyFetch).mockResolvedValueOnce(new Response(JSON.stringify(body), {status, headers}))
}
function authorize() {
  vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
    app: {key: clientId, organizationId: 'gid://shopify/Organization/42'},
  })
}
function logResponse(records: unknown[] = [record], headers = {}) {
  respond({data: {app: {logs: {records: records.map((json) => ({json}))}}}}, 200, headers)
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

test.each(['flag', 'configuration'])('trims the client ID from %s before both API calls', async (source) => {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(joinPath(directory, 'package.json'), '{}')
    await writeFile(joinPath(directory, 'shopify.app.toml'), `client_id = "  ${clientId}  "`)
    authorize()
    logResponse()

    const options = source === 'flag' ? {...scope, 'client-id': `  ${clientId}  `} : {path: directory, 'no-input': true}
    expect((await retrieveLogs(options)).logs).toEqual([record])
    expect(appManagementRequestDoc).toHaveBeenCalledWith(expect.objectContaining({variables: {clientId}}))
    expect(JSON.parse(String(vi.mocked(shopifyFetch).mock.calls[0]![1]?.body)).variables.clientId).toBe(clientId)
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
      expect(shopifyFetch).not.toHaveBeenCalled()
    })
  },
)

test('submits one bounded search and preserves the native record JSON exactly', async () => {
  authorize()
  logResponse()
  const result = await retrieveLogs({...scope, status: 'failure', topic: 'orders/create'})
  expect(result.logs).toEqual([record])
  await withCapturedStandardStreams(async ({stdout}) => {
    renderHistoricalLogs(result, true, 20)
    expect(JSON.parse(stdout()).logs).toEqual([record])
    expect(JSON.parse(stdout())).not.toHaveProperty('query')
    expect(JSON.parse(stdout())).not.toHaveProperty('pageInfo')
    expect(stdout()).not.toContain('test-identity-token')
  })
  expect(result).toMatchObject({
    ordering: 'subset-timestamp-asc',
  })
  expect(appManagementRequestDoc).toHaveBeenCalledExactlyOnceWith({
    query: LogApp,
    token: 'test-identity-token',
    variables: {clientId},
    unauthorizedHandler: {type: 'token_refresh', handler: expect.any(Function)},
  })
  const [url, init] = vi.mocked(shopifyFetch).mock.calls[0]!
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
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: true})
})

test.each([8, 20])('fast retrieval orders only the returned subset locally with limit %i', async (limit) => {
  const timestamps = [
    '2026-10-05T23:59:59.999999999Z',
    '2026-10-06T13:30:00Z',
    '2026-10-06T13:30:00.000000001Z',
    '2026-10-06T13:30:00.1Z',
    '2026-10-06T13:30:00.123456788Z',
    '2026-10-06T13:30:00.123456789Z',
    '2026-10-06T13:30:00.123456789Z',
    '2026-10-06T13:30:01Z',
  ]
  const chronological = timestamps.map((timestamp, index) => ({
    ...record,
    id: `gid://shopify/AppLogRecord/record-${index}`,
    timestamp,
  }))
  authorize()
  logResponse([
    chronological[7],
    chronological[5],
    chronological[3],
    chronological[1],
    chronological[6],
    chronological[4],
    chronological[0],
    chronological[2],
  ])

  const result = await retrieveLogs({...scope, limit})

  expect(result.logs).toEqual(chronological)
  expect(result.ordering).toBe('subset-timestamp-asc')
  const variables = JSON.parse(String(vi.mocked(shopifyFetch).mock.calls[0]?.[1]?.body)).variables
  expect(variables.limit).toBe(limit)
  expect(variables).not.toHaveProperty('sortKey')
  expect(variables).not.toHaveProperty('reverse')
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
  await withCapturedStandardStreams(async ({stdout}) => {
    renderHistoricalLogs(result, true, 20)
    expect(JSON.parse(stdout()).logs).toEqual(chronological)
    expect(JSON.parse(stdout()).ordering).toBe('subset-timestamp-asc')
  })
})

test.each([
  {order: undefined, reverse: false, ordering: 'timestamp-asc'},
  {order: 'asc', reverse: false, ordering: 'timestamp-asc'},
  {order: 'desc', reverse: true, ordering: 'timestamp-desc'},
])('requests server-side $ordering and preserves native records', async ({order, reverse, ordering}) => {
  const laterRecord = {...record, id: 'gid://shopify/AppLogRecord/later', timestamp: '2026-10-06T13:31:00Z'}
  const records = reverse ? [laterRecord, record] : [record, laterRecord]
  authorize()
  logResponse(records)

  const result = await retrieveLogs({...scope, sort: 'timestamp', order, limit: 2})

  expect(JSON.parse(String(vi.mocked(shopifyFetch).mock.calls[0]?.[1]?.body)).variables).toMatchObject({
    sortKey: 'TIMESTAMP',
    reverse,
    limit: 2,
  })
  expect(result.logs).toEqual(records)
  expect(result.ordering).toBe(ordering)
  expect(result.limitations).toEqual(['Reached the limit of 2 records; additional records may match.'])
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test.each([
  ['INVALID_LOG_QUERY', 'LOG_QUERY_FAILED'],
  ['THROTTLED', 'RATE_LIMITED'],
  ['TIMEOUT', 'QUERY_TIMEOUT'],
  ['SORTED_QUERY_TOO_LARGE', 'SORTED_QUERY_TOO_LARGE'],
])('surfaces sorted-query %s as %s without retrying unordered', async (code, expectedCode) => {
  authorize()
  const errors = [{message: 'Sorted search refused', extensions: {code}}]
  respond({errors})

  await expect(retrieveLogs({...scope, sort: 'timestamp', order: 'desc'})).rejects.toMatchObject({
    code: expectedCode,
    details: {errors},
  })
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test.each(['Admin', 'Storefront', 'CustomerAccount'])(
  'preserves %s GraphQL diagnostics, bodies, and truncation flags',
  async (target) => {
    const graphqlRecord = {
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
      renderHistoricalLogs(result, true, 20)
      expect(JSON.parse(stdout()).logs).toEqual([graphqlRecord])
    })
  },
)

test('an empty successful search has no result-limit warning', async () => {
  authorize()
  logResponse([])
  const result = await retrieveLogs(scope)
  expect(result.logs).toEqual([])
  expect(result).not.toHaveProperty('pageInfo')
  expect(result.limitations).toEqual([])
})

test.each([
  {sort: undefined, order: undefined},
  {sort: 'timestamp', order: 'asc'},
  {sort: 'timestamp', order: 'desc'},
])('a result below the limit has no completeness warning with sort $sort / $order', async ({sort, order}) => {
  authorize()
  logResponse()

  const result = await retrieveLogs({...scope, sort, order, limit: 2})

  expect(result.logs).toEqual([record])
  expect(result.limitations).toEqual([])
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test('default mixed-type search shares one query and limit, preserving every predicate', async () => {
  authorize()
  const graphqlRecord = {...record, type: 'GRAPHQL_REQUEST', api: 'storefront', timestamp: '2026-10-06T13:29:00Z'}
  logResponse([record, graphqlRecord])
  const result = await retrieveLogs({'client-id': clientId, limit: 2})
  expect(result.logs).toEqual([graphqlRecord, record])
  expect(JSON.parse(String(vi.mocked(shopifyFetch).mock.calls[0]?.[1]?.body)).variables).toMatchObject({
    types: ['WEBHOOK_DELIVERY', 'GRAPHQL_REQUEST'],
    limit: 2,
    filters: [],
  })
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test('cross-type filters are sent together and an empty intersection is not an error', async () => {
  authorize()
  logResponse([])
  const result = await retrieveLogs({'client-id': clientId, topic: 'orders/create', 'operation-name': 'MyQuery'})
  expect(result.logs).toEqual([])
  expect(JSON.parse(String(vi.mocked(shopifyFetch).mock.calls[0]?.[1]?.body)).variables).toMatchObject({
    types: ['WEBHOOK_DELIVERY', 'GRAPHQL_REQUEST'],
    filters: [
      {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
      {field: 'OPERATION_NAME', operator: 'EQUALS', value: 'MyQuery'},
    ],
  })
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test('a full cap preserves records without inventing pagination metadata', async () => {
  authorize()
  logResponse()
  const result = await retrieveLogs({...scope, limit: 1})
  expect(result.logs).toEqual([record])
  expect(result).not.toHaveProperty('pageInfo')
  expect(result.limitations).toEqual([
    'Reached the limit of 1 record; additional records may match. Fast retrieval does not necessarily select the oldest or newest matches.',
  ])
})

test.each([
  {name: 'null logs', data: {app: {logs: null}}},
  {name: 'log records', data: {app: {logs: {records: [{json: record}]}}}},
])('GraphQL errors with $name preserve diagnostics without returning data', async ({data}) => {
  const errors = [{message: 'Timed out', path: ['app', 'logs'], extensions: {code: 'THROTTLED', retryAfter: 60}}]
  const extensions = {requestId: 'test-request'}
  authorize()
  respond({data, errors, extensions})
  const failure = await retrieveLogs(scope).catch((error: unknown) => error)
  expect(failure).toMatchObject({code: 'RATE_LIMITED', details: {errors, extensions}})
  expect(failure).not.toHaveProperty('details.data')
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await handler(failure)
    expect(JSON.parse(stdout())).toEqual({
      error: {
        type: 'abort',
        message: 'Timed out',
        code: 'RATE_LIMITED',
        details: {errors, extensions},
      },
    })
    expect(stderr()).toBe('')
  })
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test.each(['APP_NOT_ACCESSIBLE', 'INVALID_LOG_QUERY'])('does not turn %s into empty success', async (code) => {
  authorize()
  respond({data: {app: null}, errors: [{message: code, extensions: {code}}]})
  await expect(retrieveLogs(scope)).rejects.toMatchObject({
    code: 'LOG_QUERY_FAILED',
    details: {errors: [{extensions: {code}}]},
  })
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test.each([null, {}, {app: null}, {app: {logs: null}}, {app: {logs: {records: null}}}])(
  'rejects invalid log results %j',
  async (data) => {
    authorize()
    respond({data}, 200, {'x-request-id': 'invalid-result-request'})
    await expect(retrieveLogs(scope)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      details: {requestId: 'invalid-result-request'},
    })
  },
)

test.each([
  null,
  'not an object',
  {...record, timestamp: null},
  {...record, timestamp: 'not-a-timestamp'},
  {...record, timestamp: '2026-10-06T14:30:00+01:00'},
  {...record, type: 'GRAPHQL_REQUEST'},
])('rejects invalid or unselected records %j', async (json) => {
  authorize()
  logResponse([json], {'x-request-id': 'invalid-record-request'})
  await expect(retrieveLogs(scope)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    details: {requestId: 'invalid-record-request'},
  })
})

test('rejects a response exceeding the requested cap rather than truncating it locally', async () => {
  authorize()
  logResponse([record, {...record, id: 'gid://shopify/AppLogRecord/second'}], {'x-request-id': 'over-limit-request'})
  await expect(retrieveLogs({...scope, limit: 1})).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    details: {requestId: 'over-limit-request'},
  })
})

test.each([
  {errors: [{message: 'Throttled without a code'}]},
  {errors: [{message: 'Unknown code', extensions: {code: 'FUTURE_CODE'}}]},
  {errors: [{message: 'Unknown code', extensions: {code: 'toString'}}]},
  {errors: [{message: 'Nonstring code', extensions: {code: 429}}]},
  {
    errors: [
      {message: 'Throttled', extensions: {code: 'THROTTLED'}},
      {message: 'Invalid input', extensions: {code: 'BAD_REQUEST'}},
    ],
  },
])('keeps a generic failure for ambiguous or unrecognized GraphQL errors $errors', async ({errors}) => {
  authorize()
  respond({errors})

  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'LOG_QUERY_FAILED', details: {errors}})
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test('preserves the supplied retry header for HTTP-200 GraphQL throttling', async () => {
  const errors = [{message: 'Throttled', extensions: {code: 'THROTTLED'}}]
  authorize()
  respond({errors}, 200, {'retry-after': '60'})

  await expect(retrieveLogs(scope)).rejects.toMatchObject({
    code: 'RATE_LIMITED',
    details: {errors, retryAfterSeconds: 60},
  })
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
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
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test.each([
  {status: 200, code: 'LOG_QUERY_FAILED', message: 'Access denied'},
  {status: 403, code: 'FORBIDDEN', message: 'App Logs request failed (HTTP 403). Access denied'},
])(
  'preserves GraphQL diagnostics and request ID on HTTP $status without partial records',
  async ({status, code, message}) => {
    const errors = [{message: 'Access denied', path: ['app', 'logs'], extensions: {code: 'APP_NOT_ACCESSIBLE'}}]
    const extensions = {traceId: 'trace-123'}
    authorize()
    respond({data: {app: {logs: {records: [{json: record}]}}}, errors, extensions}, status, {
      'x-request-id': 'request-123',
      'retry-after': '60',
    })

    const failure = await retrieveLogs(scope).catch((error: unknown) => error)

    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await handler(failure)
      expect(JSON.parse(stdout())).toEqual({
        error: {
          type: 'abort',
          code,
          message: `${message}\n\nRequest ID: request-123`,
          details: {requestId: 'request-123', errors, extensions, retryAfterSeconds: 60},
        },
      })
      expect(stdout()).not.toContain('test-signature')
      expect(stderr()).toBe('')
    })
    vi.stubEnv('SHOPIFY_FLAG_JSON', undefined)
    await withCapturedStandardStreams(async ({stderr}) => {
      await handler(failure)
      expect(stderr()).toContain('Access denied')
      expect(stderr()).toContain('Request ID: request-123')
    })
    expect(shopifyFetch).toHaveBeenCalledTimes(1)
  },
)

test.each([
  '<html>private upstream diagnostic</html>',
  JSON.stringify({errors: [{message: {privateDiagnostic: 'upstream'}}]}),
])('keeps HTTP failure context without dumping an unrecognized body %s', async (body) => {
  authorize()
  vi.mocked(shopifyFetch).mockResolvedValueOnce(
    new Response(body, {status: 503, headers: {'x-request-id': 'request-123'}}),
  )

  const failure = await retrieveLogs(scope).catch((error: unknown) => error)

  expect(failure).toMatchObject({
    code: 'LOGS_API_UNAVAILABLE',
    message:
      'App Logs request failed (HTTP 503). Check API availability, access, and authentication.\n\nRequest ID: request-123',
    details: {requestId: 'request-123'},
  })
  expect(failure).not.toHaveProperty('details.errors')
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test('includes the request ID when a successful HTTP response is not readable JSON', async () => {
  authorize()
  vi.mocked(shopifyFetch).mockResolvedValueOnce(
    new Response('<html>upstream unavailable</html>', {status: 200, headers: {'x-request-id': 'request-123'}}),
  )

  await expect(retrieveLogs(scope)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
    message: 'App Logs returned a response that could not be read as JSON.\n\nRequest ID: request-123',
    details: {requestId: 'request-123'},
  })
})

test.each(['app.shopify.com', 'app.shopify.io', 'app.shop.dev'])(
  'uses the standard App Management host %s for logs',
  async (host) => {
    vi.mocked(appManagementFqdn).mockResolvedValue(host)
    authorize()
    logResponse()
    expect((await retrieveLogs(scope)).logs).toEqual([record])
    expect(shopifyFetch).toHaveBeenCalledExactlyOnceWith(
      `https://${host}/app_logs/unstable/organizations/42/graphql`,
      expect.objectContaining({headers: expect.objectContaining({authorization: 'Bearer test-identity-token'})}),
      {useNetworkLevelRetry: false, useAbortSignal: true, timeoutMs: 45000},
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
  vi.mocked(shopifyFetch).mockResolvedValueOnce(new Response('<html>upstream unavailable</html>', {status: 200}))
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'INVALID_RESPONSE'})
})

test('does not attempt network access when no-input authentication fails', async () => {
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockRejectedValue(new Error('Sign in first'))
  await expect(retrieveLogs(scope)).rejects.toThrow('Sign in first')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: true})
  expect(shopifyFetch).not.toHaveBeenCalled()
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
  expect(shopifyFetch).not.toHaveBeenCalled()
})

test('reports transport timeouts without returning an empty result', async () => {
  authorize()
  vi.mocked(shopifyFetch).mockRejectedValueOnce(Object.assign(new Error('request aborted'), {name: 'TimeoutError'}))
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'QUERY_TIMEOUT'})
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test.each([
  {message: 'connect ECONNREFUSED', type: 'system'},
  {message: 'socket hang up', type: 'system'},
  {message: 'certificate has expired', type: 'system'},
  {message: 'redirect mode is set to error', type: 'no-redirect'},
])('reports a fetch failure as an expected error without retrying: $message', async ({message, type}) => {
  authorize()
  vi.mocked(shopifyFetch).mockRejectedValueOnce(new FetchError(message, type))
  const failure = await retrieveLogs(scope).catch((error: unknown) => error)

  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withCapturedStandardStreams(async ({stdout}) => {
    await handler(failure)
    expect(JSON.parse(stdout())).toEqual({
      error: {type: 'abort', code: 'LOGS_API_UNAVAILABLE', message: `App Logs request failed: ${message}`},
    })
  })
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test('leaves unexpected programming errors unwrapped', async () => {
  const error = new TypeError('Unexpected implementation failure')
  authorize()
  vi.mocked(shopifyFetch).mockRejectedValueOnce(error)

  await expect(retrieveLogs(scope)).rejects.toBe(error)
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test('preserves request context for a connection failure while reading the response', async () => {
  authorize()
  const response = new Response(null, {status: 200, headers: {'x-request-id': 'body-request'}})
  vi.spyOn(response, 'json').mockRejectedValueOnce(new FetchError('socket hang up', 'system'))
  vi.mocked(shopifyFetch).mockResolvedValueOnce(response)

  await expect(retrieveLogs(scope)).rejects.toMatchObject({
    code: 'LOGS_API_UNAVAILABLE',
    details: {requestId: 'body-request'},
  })
})

test.each(['AbortError', 'TimeoutError'])('reports a body-read %s as a timeout without retrying', async (name) => {
  authorize()
  const response = new Response(null, {status: 200, headers: {'x-request-id': 'body-request'}})
  vi.spyOn(response, 'json').mockRejectedValueOnce(Object.assign(new Error('request aborted'), {name}))
  vi.mocked(shopifyFetch).mockResolvedValueOnce(response)

  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'QUERY_TIMEOUT', details: {requestId: 'body-request'}})
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
})

test.each(['42', 'gid://shopify/App/42', 'gid://shopify/Organization/42/extra'])(
  'rejects invalid organization identifiers %s',
  async (organizationId) => {
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({app: {key: clientId, organizationId}})
    await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'FORBIDDEN'})
    expect(shopifyFetch).not.toHaveBeenCalled()
  },
)

test('rejects an app lookup for another client ID without querying logs', async () => {
  vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
    app: {key: 'other-app', organizationId: 'gid://shopify/Organization/42'},
  })
  await expect(retrieveLogs(scope)).rejects.toMatchObject({code: 'FORBIDDEN'})
  expect(shopifyFetch).not.toHaveBeenCalled()
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
  expect(JSON.parse(String(vi.mocked(shopifyFetch).mock.calls[0]?.[1]?.body)).variables.timestamp).toEqual({
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
  expect(vi.mocked(shopifyFetch).mock.calls[0]?.[1]?.headers).toMatchObject({
    authorization: 'Bearer test-identity-token',
  })
})

test('propagates app lookup failures without querying logs', async () => {
  const failure = new Error('App lookup denied')
  vi.mocked(appManagementRequestDoc).mockRejectedValueOnce(failure)
  await expect(retrieveLogs(scope)).rejects.toBe(failure)
  expect(shopifyFetch).not.toHaveBeenCalled()
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
  expect(shopifyFetch).toHaveBeenCalledTimes(1)
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
  expect(shopifyFetch).not.toHaveBeenCalled()
})
