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

const options = {organizationId: '1', clientId: 'test-app', minutes: 15, limit: 3, demo: false}

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
  const result = {app_key: 'test-app', events: [{'payload.type': 'WEBHOOK_DELIVERY'}], exhaustive: false}
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result), {status: 200}))
  await expect(queryAppLogs({...options, types: ['WEBHOOK_DELIVERY']})).resolves.toEqual(result)
  expect(fetch).toHaveBeenCalledWith(
    'https://app.shop.dev/app_management/unstable/organizations/1/app_logs/query',
    expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      size: 1024 * 1024,
      headers: expect.objectContaining({authorization: 'Bearer atkn_local-identity'}),
      body: expect.stringContaining('"types":["WEBHOOK_DELIVERY"]'),
    }),
  )
  const input = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)
  expect(input.api_key).toBe('test-app')
  expect(input.limit).toBe(3)
  expect(Date.parse(input.end_time) - Date.parse(input.start_time)).toBe(15 * 60 * 1000)
})

test('uses the temporary token only for the fixed loopback demo, without logging into Identity', async () => {
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'token')
    await writeFile(path, 'atkn_demo-only')
    vi.stubEnv('APP_LOG_QUERY_DEMO_TOKEN_FILE', path)
    vi.mocked(fetch).mockResolvedValue(new Response('{"events":[]}', {status: 200}))
    await expect(queryAppLogs({...options, demo: true})).resolves.toEqual({events: []})
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:4387/app_management/unstable/organizations/1/app_logs/query',
      expect.objectContaining({headers: expect.objectContaining({authorization: 'Bearer atkn_demo-only'})}),
    )
    expect(ensureAuthenticatedAppManagementAndBusinessPlatform).not.toHaveBeenCalled()
  })
})

test('surfaces API errors instead of turning them into an empty result', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('private upstream details', {status: 502}))
  await expect(queryAppLogs(options)).rejects.toThrow('HTTP 502')
})

test('rejects a path-injection organization ID and oversized request limits', async () => {
  await expect(queryAppLogs({...options, organizationId: '../2'})).rejects.toThrow('numeric organization ID')
  await expect(queryAppLogs({...options, limit: 101})).rejects.toThrow('limit of 1–100')
  expect(fetch).not.toHaveBeenCalled()
})
