import {executeLogsQuery} from './logs-query.js'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/context/fqdn')
vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  fetch: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  readStdinString: vi.fn(),
}))

const options = {query: '{ __typename }', noPrompt: false, demo: false}

test('rejects an unsupported API before authentication', async () => {
  await expect(executeLogsQuery({...options, api: 'unknown'})).rejects.toThrow('Unsupported logs API')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

beforeEach(() => {
  vi.stubEnv('SHOPIFY_APP_LOG_QUERY_PROTOTYPE', '1')
  vi.stubEnv('SHOPIFY_SERVICE_ENV', 'local')
  vi.stubEnv('SHOPIFY_APP_AUTOMATION_TOKEN', undefined)
  vi.stubEnv('SHOPIFY_CLI_PARTNERS_TOKEN', undefined)
  vi.mocked(appManagementFqdn).mockResolvedValue('app.shop.dev')
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValue({
    appManagementToken: 'atkn_local-identity',
    userId: 'local-user',
    businessPlatformToken: 'unused',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test.each([
  ['SHOPIFY_SERVICE_ENV', 'production'],
  ['SHOPIFY_APP_LOG_QUERY_PROTOTYPE', '0'],
])('refuses %s=%s before authenticating or sending a request', async (name, value) => {
  vi.stubEnv(name, value)
  await expect(executeLogsQuery(options)).rejects.toThrow('Prototype only')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('refuses an unexpected host before obtaining a token', async () => {
  vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
  await expect(executeLogsQuery(options)).rejects.toThrow('only call app.shop.dev')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test.each(['SHOPIFY_APP_AUTOMATION_TOKEN', 'SHOPIFY_CLI_PARTNERS_TOKEN'])(
  'rejects %s instead of treating an automation token as an account session',
  async (name) => {
    vi.stubEnv(name, 'automation-token')
    await expect(executeLogsQuery(options)).rejects.toThrow('requires a signed-in Shopify account')
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)

test('forwards the document, variables and operation name without building a logs query', async () => {
  const query = `
    query Logs($key: String!, $search: AppLogSearchInput!) {
      chosenApp: app(key: $key) { logs(input: $search) { events { ...Details } } }
    }
    fragment Details on LogRecord { timestamp }
  `
  const variables = {key: 'test-app', search: {limit: 10001, offset: 1000001}}
  const response = {data: {chosenApp: {logs: {events: [{timestamp: '2026-09-28T20:00:00Z'}]}}}}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))

  await expect(
    executeLogsQuery({...options, query, variables: JSON.stringify(variables), operationName: 'Logs', noPrompt: true}),
  ).resolves.toEqual({response, failed: false})

  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledExactlyOnceWith({noPrompt: true})
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    'https://app.shop.dev/app_observability/unstable/graphql',
    expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      signal: expect.any(AbortSignal),
      headers: expect.objectContaining({authorization: 'Bearer atkn_local-identity'}),
      body: JSON.stringify({query, variables, operationName: 'Logs'}),
    }),
  )
})

test('supports introspection without an app key and preserves extensions', async () => {
  const query = '{ __schema { queryType { name } } }'
  const response = {data: {__schema: {queryType: {name: 'QueryRoot'}}}, extensions: {requestId: 'example'}}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))

  await expect(executeLogsQuery({...options, query})).resolves.toEqual({response, failed: false})
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({query})
})

test('reads the document and variables from files', async () => {
  await inTemporaryDirectory(async (directory) => {
    const queryFile = joinPath(directory, 'query.graphql')
    const variableFile = joinPath(directory, 'variables.json')
    const query = 'query App($key: String!) { app(key: $key) { key } }\n'
    await writeFile(queryFile, query)
    await writeFile(variableFile, '{"key":"test-app"}')
    vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"app":{"key":"test-app"}}}'))

    await executeLogsQuery({...options, query: undefined, queryFile, variableFile})

    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({
      query,
      variables: {key: 'test-app'},
    })
  })
})

test('reads a document from stdin when query-file is a dash', async () => {
  vi.mocked(readStdinString).mockResolvedValue(options.query)
  vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"__typename":"QueryRoot"}}'))

  await executeLogsQuery({...options, query: undefined, queryFile: '-'})

  expect(readStdinString).toHaveBeenCalledOnce()
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({query: options.query})
})

test('authenticates the fixed loopback demo through local Identity too', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"__typename":"QueryRoot"}}'))

  await executeLogsQuery({...options, demo: true})

  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).toHaveBeenCalledExactlyOnceWith({noPrompt: false})
  expect(fetch).toHaveBeenCalledWith(
    'http://127.0.0.1:4388/app_observability/unstable/graphql',
    expect.objectContaining({headers: expect.objectContaining({authorization: 'Bearer atkn_local-identity'})}),
  )
})

test.each([200, 400])('preserves errors, paths, extensions and partial data for HTTP %s', async (status) => {
  const response = {
    data: {app: null},
    errors: [
      {message: 'Access denied', path: ['app'], locations: [{line: 1, column: 3}], extensions: {code: 'DENIED'}},
    ],
    extensions: {requestId: 'example'},
  }
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response), {status}))

  await expect(executeLogsQuery(options)).resolves.toEqual({response, failed: true})
})

test('preserves request errors without data', async () => {
  const response = {errors: [{message: 'Unknown field'}]}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))
  await expect(executeLogsQuery({...options, query: '{ unknownField }'})).resolves.toEqual({response, failed: true})
})

test('does not turn an HTTP failure with data into success', async () => {
  const response = {data: null}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response), {status: 503}))
  await expect(executeLogsQuery(options)).resolves.toEqual({response, failed: true})
})

test.each([null, [], {}, {data: []}, {errors: []}, {errors: [{}]}].map((body) => ({body})))(
  'rejects a malformed GraphQL envelope %j',
  async ({body}) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body)))
    await expect(executeLogsQuery(options)).rejects.toThrow('invalid GraphQL response')
  },
)

test('reports non-JSON HTTP failures without echoing their bodies', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('private upstream diagnostic', {status: 502}))
  await expect(executeLogsQuery(options)).rejects.toThrow('invalid JSON (HTTP 502)')
})

test.each([new Error('Connection refused'), new DOMException('Timed out', 'TimeoutError')])(
  'propagates transport failures without retrying: %s',
  async (error) => {
    vi.mocked(fetch).mockRejectedValue(error)
    await expect(executeLogsQuery(options)).rejects.toBe(error)
    expect(fetch).toHaveBeenCalledOnce()
  },
)

test('accepts responses larger than one MiB without a client byte cap', async () => {
  const response = {data: {largeValue: 'x'.repeat(2 * 1024 * 1024)}}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))

  await expect(executeLogsQuery(options)).resolves.toEqual({response, failed: false})
  expect(vi.mocked(fetch).mock.calls[0]![1]?.size).toBeUndefined()
})

test.each([
  {query: undefined},
  {queryFile: 'also.graphql'},
  {query: ''},
  {query: '  '},
  {variables: '{}', variableFile: 'also.json'},
  {variables: 'not json'},
  {variables: 'null'},
  {variables: '[]'},
  {variables: '1'},
])('rejects invalid input %j before authentication', async (input) => {
  await expect(executeLogsQuery({...options, ...input})).rejects.toThrow()
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('rejects stdin without a document before authentication', async () => {
  vi.mocked(readStdinString).mockResolvedValue(undefined)
  await expect(executeLogsQuery({...options, query: undefined, queryFile: '-'})).rejects.toThrow('nonempty GraphQL')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
})

test('reports missing query files without making a request', async () => {
  await inTemporaryDirectory(async (directory) => {
    await expect(
      executeLogsQuery({...options, query: undefined, queryFile: joinPath(directory, 'missing.graphql')}),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})
