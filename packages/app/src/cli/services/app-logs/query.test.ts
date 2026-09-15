import {queryAppLogs} from './query.js'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {Response} from 'node-fetch'

vi.mock('@shopify/cli-kit/node/context/fqdn')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/session')

const options = {clientId: 'test-app', minutes: 15, limit: 3, offset: 0, demo: false}

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

test('refuses production services before authenticating or sending a request', async () => {
  vi.stubEnv('SHOPIFY_SERVICE_ENV', 'production')
  await expect(queryAppLogs(options)).rejects.toThrow('Prototype only')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('refuses an unexpected host before obtaining a token', async () => {
  vi.mocked(appManagementFqdn).mockResolvedValue('app.shopify.com')
  await expect(queryAppLogs(options)).rejects.toThrow('only call app.shop.dev')
  expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
})

test('sends a bounded app query using the normal CLI authentication helper', async () => {
  const result = {appKey: 'test-app', events: [{type: 'WEBHOOK_DELIVERY'}], exhaustive: false}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({data: {app: {logs: result}}}), {status: 200}))
  await expect(queryAppLogs({...options, types: ['WEBHOOK_DELIVERY']})).resolves.toEqual(result)
  expect(fetch).toHaveBeenCalledWith(
    'https://app.shop.dev/dev_platform/unstable/graphql',
    expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      headers: expect.objectContaining({authorization: 'Bearer atkn_local-identity'}),
      body: expect.stringContaining('"types":["WEBHOOK_DELIVERY"]'),
    }),
  )
  const request = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
  expect(request.query).toContain('query AppLogs($appKey: String!, $search: AppLogSearchInput!)')
  expect(request.query).toContain('app(key: $appKey)')
  expect(request.query).toContain('logs(input: $search)')
  expect(request.query).toContain('recordUid timestamp type')
  expect(request.operationName).toBe('AppLogs')
  expect(request.variables.appKey).toBe('test-app')
  const input = request.variables.search
  expect(input).not.toHaveProperty('appKey')
  expect(input.limit).toBe(3)
  expect(input.offset).toBe(0)
  expect(Date.parse(input.endTime) - Date.parse(input.startTime)).toBe(15 * 60 * 1000)
})

test('uses the temporary token only for the fixed loopback demo, without logging into Identity', async () => {
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'token')
    await writeFile(path, 'atkn_demo-only')
    vi.stubEnv('APP_LOG_QUERY_DEMO_TOKEN_FILE', path)
    vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"app":{"logs":{"events":[]}}}}', {status: 200}))
    await expect(queryAppLogs({...options, demo: true})).resolves.toEqual({events: []})
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4387/dev_platform/unstable/graphql',
      expect.objectContaining({headers: expect.objectContaining({authorization: 'Bearer atkn_demo-only'})}),
    )
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  })
})

test('surfaces API errors instead of turning them into an empty result', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('private upstream details', {status: 502}))
  await expect(queryAppLogs(options)).rejects.toThrow('HTTP 502')
})

test('forwards a 10000 event limit and 1000000 offset independently', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"app":{"logs":{"events":[]}}}}', {status: 200}))
  await expect(queryAppLogs({...options, limit: 10_000, offset: 1_000_000})).resolves.toEqual({events: []})
  const input = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string).variables.search
  expect(input.limit).toBe(10_000)
  expect(input.offset).toBe(1_000_000)
})

test('leaves upper policy limits to the server', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('{"errors":[{"message":"Query limits exceeded"}]}', {status: 200}))
  await expect(queryAppLogs({...options, minutes: 61, limit: 10_001, offset: 1_000_001})).rejects.toThrow(
    'Query limits exceeded',
  )
  const input = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string).variables.search
  expect(input.limit).toBe(10_001)
  expect(input.offset).toBe(1_000_001)
})

test('reads valid responses larger than one MiB without a client byte cap', async () => {
  const result = {events: [{target: 'x'.repeat(2 * 1024 * 1024)}]}
  vi.mocked(fetch).mockImplementation(async (_url, init) => {
    const responseOptions = {status: 200, size: init?.size}
    return new Response(JSON.stringify({data: {app: {logs: result}}}), responseOptions)
  })

  await expect(queryAppLogs(options)).resolves.toEqual(result)
  expect(vi.mocked(fetch).mock.calls[0]![1]?.size).toBeUndefined()
})

test('rejects an empty app key before making a request', async () => {
  await expect(queryAppLogs({...options, clientId: ''})).rejects.toThrow('nonempty app client ID')
  expect(fetch).not.toHaveBeenCalled()
})

test('passes the app key as a variable instead of interpolating query syntax or paths', async () => {
  const clientId = '../app" } other: app(key: "another-app") { key } #'
  vi.mocked(fetch).mockResolvedValue(new Response('{"data":{"app":{"logs":{"events":[]}}}}', {status: 200}))

  await queryAppLogs({...options, clientId})

  const [url, init] = vi.mocked(fetch).mock.calls[0]!
  const request = JSON.parse(init!.body as string)
  expect(url).toBe('https://app.shop.dev/dev_platform/unstable/graphql')
  expect(request.variables.appKey).toBe(clientId)
  expect(request.query).not.toContain(clientId)
})

test('surfaces GraphQL errors even when HTTP succeeds and partial data is present', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({data: {app: {logs: {events: []}}}, errors: [{message: 'Log query failed'}]}), {
      status: 200,
    }),
  )
  await expect(queryAppLogs(options)).rejects.toThrow('Log query failed')
})

test.each([{data: {app: {logs: null}}}, {data: {app: null}}, {data: null}, {}])(
  'rejects a missing log result %j',
  async (body) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), {status: 200}))
    await expect(queryAppLogs(options)).rejects.toThrow('no app logs result')
  },
)

test.each([null, [], {data: {app: []}}, {data: {app: {}}}, {data: {app: {logs: []}}}])(
  'rejects a malformed GraphQL envelope %j',
  async (body) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), {status: 200}))
    await expect(queryAppLogs(options)).rejects.toThrow('invalid GraphQL response')
  },
)

test.each([{minutes: 0}, {minutes: 1.5}, {limit: 0}, {limit: 1.5}, {offset: -1}, {offset: 1.5}])(
  'rejects malformed numeric options %j before making a request',
  async (invalidOptions) => {
    await expect(queryAppLogs({...options, ...invalidOptions})).rejects.toThrow('positive integers')
    expect(fetch).not.toHaveBeenCalled()
  },
)
