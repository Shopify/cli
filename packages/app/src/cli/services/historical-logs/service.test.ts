import {retrieveLogs} from './service.js'
import {renderHistoricalLogs} from './presenter.js'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {setupServer} from 'msw/node'
import {graphql, http, HttpResponse, type GraphQLResponseBody} from 'msw'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/context/fqdn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/fqdn')>()),
  appManagementFqdn: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/environment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/environment')>()),
  getAppAutomationToken: vi.fn(),
}))

const clientId = 'test-app'
const scope = {'client-id': clientId, 'no-input': true}
const logsUrl = 'https://app.example.com/app_logs/unstable/organizations/42/graphql'
const event = {
  id: 'gid://shopify/AppLogRecord/example',
  timestamp: '2026-10-06T13:30:00.123456789Z',
  type: 'WEBHOOK_DELIVERY',
  shopDomain: 'example.myshopify.com',
  webhookDelivery: {
    topic: 'orders/create',
    resultStatus: 'RESULT_STATUS_FAILURE',
    statusCode: null,
    responseTimeMs: null,
    deliveryAttempt: 2,
  },
  functionRun: null,
}

function logData(events = [event]) {
  return {app: {logs: {clientId, limit: 20, limitReached: false, exhaustive: false, ordering: 'NONE', events}}}
}

function response(body: NonNullable<GraphQLResponseBody<Record<string, unknown>>>, status = 200) {
  return HttpResponse.json<typeof body>(body, {
    status,
    headers: {date: 'Tue, 06 Oct 2026 14:00:00 GMT', 'retry-after': '0', 'x-request-id': 'logs-request'},
  })
}

let server: ReturnType<typeof setupServer>
beforeEach(() => {
  vi.mocked(appManagementFqdn).mockResolvedValue('app.example.com')
  vi.mocked(getAppAutomationToken).mockReturnValue(undefined)
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValue({
    appManagementToken: 'test-identity-token',
    userId: 'test-user',
    businessPlatformToken: 'test-business-token',
  })
  server = setupServer(
    graphql.query('LogApp', () =>
      response({data: {app: {key: clientId, organizationId: 'gid://shopify/Organization/42'}}}),
    ),
    graphql.query('AppLogScope', () => response({data: {app: {clientId}}})),
    graphql.query('HistoricalLogs', () => response({data: logData()})),
  )
  server.listen({onUnhandledRequest: 'error'})
})
afterEach(() => {
  server.close()
  mockAndCaptureOutput().clear()
})

test('searches the resolved organization with Identity auth and preserves record timestamps', async () => {
  let search: unknown
  let authorization: string | null = null
  server.use(
    graphql.query('HistoricalLogs', ({request, variables}) => {
      search = {url: request.url, variables}
      authorization = request.headers.get('authorization')
      return response({data: logData()})
    }),
  )
  const result = await retrieveLogs({...scope, type: ['webhook']})
  expect(search).toEqual({
    url: logsUrl,
    variables: {
      clientId,
      input: {
        types: ['WEBHOOK_DELIVERY'],
        startTime: '2026-10-06T13:00:00Z',
        endTime: '2026-10-06T14:00:00.000Z',
        limit: 20,
      },
    },
  })
  expect(authorization).toBe('Bearer test-identity-token')
  expect(result).toMatchObject({
    status: 'success',
    query: {clientId, clockSource: 'scope-response'},
    ordering: 'none',
    pageInfo: {returnedCount: 1, moreRecordsMatched: null},
    logs: [{timestamp: event.timestamp, outcome: 'failure'}],
  })
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledWith({noPrompt: true})
})

test('refreshes an expired user token and uses the refreshed token for the search', async () => {
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValueOnce({
    appManagementToken: 'expired',
    userId: 'test-user',
    businessPlatformToken: 'test-business-token',
  })
  let authorization: string | null = null
  server.use(
    graphql.query('AppLogScope', () => response({errors: [{message: 'Expired'}]}, 401), {once: true}),
    graphql.query('HistoricalLogs', ({request}) => {
      authorization = request.headers.get('authorization')
      return response({data: logData()})
    }),
  )
  await expect(retrieveLogs(scope)).resolves.toMatchObject({status: 'success'})
  expect(authorization).toBe('Bearer test-identity-token')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenLastCalledWith({
    noPrompt: true,
    forceRefresh: true,
  })
})

test('resolves the app from a selected local configuration', async () => {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(joinPath(directory, 'package.json'), '{}')
    await writeFile(joinPath(directory, 'shopify.app.production.toml'), `client_id = "${clientId}"`)
    const result = await retrieveLogs({path: directory, config: 'production', 'no-input': true})
    expect(result.query.clientId).toBe(clientId)
  })
})

test('an explicit app selector works without reading a local project', async () => {
  await expect(retrieveLogs({...scope, path: '/does-not-exist'})).resolves.toMatchObject({query: {clientId}})
})

test.each([{limit: 0}, {type: ['unknown']}, {'client-id': ''}])(
  'rejects invalid selectors before auth %j',
  async (options) => {
    await expect(retrieveLogs({...scope, ...options})).rejects.toMatchObject({details: {code: 'INVALID_ARGUMENT'}})
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  },
)

test('does not authenticate automation credentials as an Identity user', async () => {
  vi.mocked(getAppAutomationToken).mockReturnValue('automation-token')
  await expect(retrieveLogs(scope)).rejects.toMatchObject({details: {code: 'AUTHENTICATION_REQUIRED'}})
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
})

test('propagates no-input authentication failure', async () => {
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockRejectedValue(new Error('Sign in first'))
  await expect(retrieveLogs(scope)).rejects.toThrow('Sign in first')
})

test('preserves surviving records and GraphQL errors as a partial result', async () => {
  server.use(
    graphql.query('HistoricalLogs', () =>
      response({data: logData(), errors: [{message: 'One shard failed', path: ['app', 'logs', 'events']}]}),
    ),
  )
  await expect(retrieveLogs(scope)).resolves.toMatchObject({
    status: 'partial',
    logs: [{gid: event.id}],
    errors: [{code: 'PARTIAL_RESULT', message: 'One shard failed', fieldPath: ['app', 'logs', 'events']}],
  })
})

test('does not turn a fatal GraphQL error into an empty result', async () => {
  server.use(
    graphql.query('HistoricalLogs', () =>
      response({data: {app: null}, errors: [{message: 'No access', extensions: {code: 'FORBIDDEN'}}]}),
    ),
  )
  await expect(retrieveLogs(scope)).rejects.toMatchObject({details: {code: 'FORBIDDEN'}})
})

test.each([401, 403, 404, 429, 500, 504])('propagates HTTP %s failures', async (status) => {
  server.use(graphql.query('HistoricalLogs', () => response({errors: [{message: 'Unavailable'}]}, status)))
  await expect(retrieveLogs(scope)).rejects.toThrow(`HTTP ${status}`)
})

test.each([
  null,
  {key: 'another-app', organizationId: 'gid://shopify/Organization/42'},
  {key: clientId, organizationId: '42'},
])('rejects unresolved or mismatched app scope %j', async (app) => {
  server.use(graphql.query('LogApp', () => response({data: {app}})))
  await expect(retrieveLogs(scope)).rejects.toMatchObject({details: {code: 'FORBIDDEN'}})
})

test('rejects missing server time rather than using the client clock', async () => {
  server.use(graphql.query('AppLogScope', () => HttpResponse.json({data: {app: {clientId}}})))
  await expect(retrieveLogs(scope)).rejects.toThrow('server time')
})

test.each([{}, {app: {logs: null}}, logData([{...event, type: 'UNRECOGNIZED'}])])(
  'rejects invalid log results %j',
  async (data) => {
    server.use(graphql.query('HistoricalLogs', () => response({data})))
    await expect(retrieveLogs(scope)).rejects.toMatchObject({details: {code: 'INVALID_RESPONSE'}})
  },
)

test('does not turn unreadable JSON into an empty result', async () => {
  server.use(http.post(logsUrl, () => new HttpResponse('<html>upstream unavailable</html>')))
  await expect(retrieveLogs(scope)).rejects.toThrow()
})

test('returns successful empty results without asserting completeness', async () => {
  server.use(graphql.query('HistoricalLogs', () => response({data: logData([])})))
  await expect(retrieveLogs(scope)).resolves.toMatchObject({
    status: 'success',
    logs: [],
    pageInfo: {moreRecordsMatched: null},
  })
})

test('renders limit warnings and escapes terminal controls in log data', async () => {
  const result = await retrieveLogs(scope)
  result.logs[0]!.store = 'example\n\u001b[31munsafe\u202ename'
  result.pageInfo.limitReached = true
  renderHistoricalLogs(result, false)
  const output = mockAndCaptureOutput().output()
  expect(output).toContain('Result limit reached')
  expect(output).toContain('example\\u000aunsafe\\u202ename')
  expect(output).not.toContain('\u001b[31m')
})
