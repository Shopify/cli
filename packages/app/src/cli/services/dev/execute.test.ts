import {executeAppLogsOperation} from './execute.js'
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

const options = {query: '{ __typename }', demo: false}

beforeEach(() => {
  vi.stubEnv('SHOPIFY_APP_LOG_QUERY_PROTOTYPE', '1')
  vi.stubEnv('SHOPIFY_SERVICE_ENV', 'local')
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
  await expect(executeAppLogsOperation(options)).rejects.toThrow('Prototype only')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('refuses an unexpected host before obtaining a token', async () => {
  vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
  await expect(executeAppLogsOperation(options)).rejects.toThrow('only call app.shop.dev')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('forwards the exact document, variables and operation name without building a logs query', async () => {
  const query = `
    query Logs($key: String!, $search: AppLogSearchInput!) {
      chosenApp: app(key: $key) {
        logs(input: $search) { events { ...Details } }
      }
    }
    fragment Details on LogRecord { timestamp payload }
  `
  const variables = {key: 'test-app', search: {limit: 10001, offset: 1000001}}
  const response = {data: {chosenApp: {logs: {events: [{timestamp: '2026-09-16T20:00:00Z'}]}}}}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))

  await expect(
    executeAppLogsOperation({...options, query, variables: JSON.stringify(variables), operationName: 'Logs'}),
  ).resolves.toEqual({response, failed: false})

  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    'https://app.shop.dev/app_logs/unstable/graphql',
    expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      headers: expect.objectContaining({authorization: 'Bearer atkn_local-identity'}),
      body: JSON.stringify({query, variables, operationName: 'Logs'}),
    }),
  )
})

test('supports introspection without an app key and preserves extensions', async () => {
  const query = '{ __schema { queryType { name } } }'
  const response = {data: {__schema: {queryType: {name: 'QueryRoot'}}}, extensions: {requestId: 'example'}}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))

  await expect(executeAppLogsOperation({...options, query})).resolves.toEqual({response, failed: false})
  const request = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
  expect(request).toEqual({query})
})

test('lets the server select an operation in a multi-operation document', async () => {
  const query = 'query One { __typename } query Two { __schema { queryType { name } } }'
  const response = {data: {__typename: 'QueryRoot'}}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))

  await executeAppLogsOperation({...options, query, operationName: 'One'})

  expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({query, operationName: 'One'})
})

test('reads the document and variables from real files', async () => {
  await inTemporaryDirectory(async (directory) => {
    const queryFile = joinPath(directory, 'query.graphql')
    const variableFile = joinPath(directory, 'variables.json')
    const query = 'query App($key: String!) { app(key: $key) { key } }\n'
    await writeFile(queryFile, query)
    await writeFile(variableFile, '{"key":"test-app"}')
    vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"app":{"key":"test-app"}}}'))

    await executeAppLogsOperation({queryFile, variableFile, demo: false})

    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({
      query,
      variables: {key: 'test-app'},
    })
  })
})

test('reads a document from stdin when query-file is a dash', async () => {
  vi.mocked(readStdinString).mockResolvedValue(options.query)
  vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"__typename":"QueryRoot"}}'))

  await executeAppLogsOperation({queryFile: '-', demo: false})

  expect(readStdinString).toHaveBeenCalledOnce()
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({query: options.query})
})

test('uses the temporary token only for the fixed loopback demo', async () => {
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'token')
    await writeFile(path, 'atkn_demo-only\n')
    vi.stubEnv('APP_LOG_QUERY_DEMO_TOKEN_FILE', path)
    vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"__typename":"QueryRoot"}}'))

    await expect(executeAppLogsOperation({...options, demo: true})).resolves.toEqual({
      response: {data: {__typename: 'QueryRoot'}},
      failed: false,
    })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4387/app_logs/unstable/graphql',
      expect.objectContaining({headers: expect.objectContaining({authorization: 'Bearer atkn_demo-only'})}),
    )
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  })
})

test('requires a demo token file instead of falling back to Identity', async () => {
  vi.stubEnv('APP_LOG_QUERY_DEMO_TOKEN_FILE', '')
  await expect(executeAppLogsOperation({...options, demo: true})).rejects.toThrow('APP_LOG_QUERY_DEMO_TOKEN_FILE')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test.each(['', 'not-a-token', `atkn_${'x'.repeat(4096)}`])('rejects an invalid demo token %#', async (token) => {
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'token')
    await writeFile(path, token)
    vi.stubEnv('APP_LOG_QUERY_DEMO_TOKEN_FILE', path)
    await expect(executeAppLogsOperation({...options, demo: true})).rejects.toThrow('Invalid demo token')
    expect(fetch).not.toHaveBeenCalled()
  })
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

  await expect(executeAppLogsOperation(options)).resolves.toEqual({response, failed: true})
})

test('preserves request errors without data', async () => {
  const response = {errors: [{message: 'Unknown field'}]}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response)))

  await expect(executeAppLogsOperation({...options, query: '{ unknownField }'})).resolves.toEqual({
    response,
    failed: true,
  })
})

test('does not turn an HTTP failure with data into success', async () => {
  const response = {data: null}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response), {status: 503}))
  await expect(executeAppLogsOperation(options)).resolves.toEqual({response, failed: true})
})

test.each([null, [], {}, {data: []}, {errors: []}, {errors: [{}]}])(
  'rejects a malformed GraphQL envelope %j',
  async (body) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body)))
    await expect(executeAppLogsOperation(options)).rejects.toThrow('invalid GraphQL response')
  },
)

test('reports non-JSON HTTP failures without echoing their bodies', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('private upstream diagnostic', {status: 502}))
  await expect(executeAppLogsOperation(options)).rejects.toThrow('invalid JSON (HTTP 502)')
})

test('propagates network failures without retrying', async () => {
  const error = new Error('Connection refused')
  vi.mocked(fetch).mockRejectedValue(error)
  await expect(executeAppLogsOperation(options)).rejects.toBe(error)
  expect(fetch).toHaveBeenCalledOnce()
})

test('accepts responses larger than one MiB without a client byte cap', async () => {
  const response = {data: {largeValue: 'x'.repeat(2 * 1024 * 1024)}}
  vi.mocked(fetch).mockImplementation(async (_url, init) => {
    const responseOptions = {status: 200, size: init?.size}
    return new Response(JSON.stringify(response), responseOptions)
  })

  await expect(executeAppLogsOperation(options)).resolves.toEqual({response, failed: false})
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
  await expect(executeAppLogsOperation({...options, ...input})).rejects.toThrow()
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('rejects stdin without a document before authentication', async () => {
  vi.mocked(readStdinString).mockResolvedValue(undefined)
  await expect(executeAppLogsOperation({queryFile: '-', demo: false})).rejects.toThrow('nonempty GraphQL')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
})

test('reports missing query files without making a request', async () => {
  await inTemporaryDirectory(async (directory) => {
    await expect(
      executeAppLogsOperation({queryFile: joinPath(directory, 'missing.graphql'), demo: false}),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})
