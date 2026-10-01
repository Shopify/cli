import {resolveLogsApp, searchLogs} from './logs-search.js'
import {executeLogsQuery} from './logs-query.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('./logs-query.js')
vi.mock('./local-storage.js')

const account = {noPrompt: true, demo: false}

afterEach(() => {
  vi.useRealTimers()
})

test('explicit client ID works outside an app project', async () => {
  await expect(resolveLogsApp({...account, clientId: 'selected-app', path: '/missing-project'})).resolves.toBe(
    'selected-app',
  )
})

test.each([undefined, 'staging'])('reads client ID from the selected TOML config (%s)', async (config) => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(joinPath(path, 'shopify.app.toml'), 'client_id = "default-app"')
    await writeFile(joinPath(path, 'shopify.app.staging.toml'), 'client_id = "staging-app"')
    await expect(resolveLogsApp({...account, path, config})).resolves.toBe(config ? 'staging-app' : 'default-app')
  })
})

test('unlinked config reports how to select an app', async () => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(joinPath(path, 'shopify.app.toml'), 'name = "Unlinked"')
    await expect(resolveLogsApp({...account, path})).rejects.toThrow('Set client_id')
  })
})

test('malformed config fails visibly', async () => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(joinPath(path, 'shopify.app.toml'), 'client_id = [')
    await expect(resolveLogsApp({...account, path})).rejects.toThrow()
  })
})

test('default search uses a bounded hour and preserves API limits and errors', async () => {
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  const response = {
    data: {app: {logs: {events: [], limitReached: true, exhaustive: false, ordering: 'unspecified'}}},
    errors: [{message: 'Partial failure'}],
    extensions: {requestId: 'request-1'},
  }
  vi.mocked(executeLogsQuery).mockResolvedValue({response, failed: true})
  const result = await searchLogs({...account, clientId: 'test-app'})
  const request = vi.mocked(executeLogsQuery).mock.calls[0]![0]
  expect(JSON.parse(request.variables!)).toEqual({
    appKey: 'test-app',
    search: {
      startTime: '2026-10-01T11:00:00.000Z',
      endTime: '2026-10-01T12:00:00.000Z',
      limit: 50,
      offset: 0,
    },
  })
  expect(result.failed).toBe(true)
  expect(result.response).toMatchObject(response)
  expect(result.response.extensions?.logQuery).toMatchObject({appKey: 'test-app', limit: 50})
  expect(request.query).toContain('limitReached exhaustive ordering')
})

test('filters and pagination become GraphQL variables, not interpolated query text', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({response: {data: null}, failed: false})
  await searchLogs({
    ...account,
    clientId: 'app-with-"quotes',
    types: ['WEBHOOK_DELIVERY'],
    since: '15m',
    until: '2026-10-01T12:00:00Z',
    shop: 'example.myshopify.com',
    statusCode: '500',
    limit: 10,
    offset: 10,
    sort: 'TIMESTAMP_DESC',
  })
  const request = vi.mocked(executeLogsQuery).mock.calls[0]![0]
  expect(JSON.parse(request.variables!)).toEqual({
    appKey: 'app-with-"quotes',
    search: {
      startTime: '2026-10-01T11:45:00.000Z',
      endTime: '2026-10-01T12:00:00Z',
      types: ['WEBHOOK_DELIVERY'],
      limit: 10,
      offset: 10,
      sort: 'TIMESTAMP_DESC',
      filterGroup: {
        filters: [
          {column: 'SHOP_DOMAIN', op: 'EQUALS', values: ['example.myshopify.com']},
          {column: 'WEBHOOK_STATUS_CODE', op: 'EQUALS', values: ['500']},
        ],
      },
    },
  })
  expect(request.query).not.toContain('app-with-')
})

test('absolute timestamps retain their original precision', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({response: {data: null}, failed: false})
  await searchLogs({
    ...account,
    clientId: 'test-app',
    since: '2026-10-01T11:59:00.123456789Z',
    until: '2026-10-01T12:00:00Z',
  })
  expect(JSON.parse(vi.mocked(executeLogsQuery).mock.calls[0]![0].variables!).search.startTime).toBe(
    '2026-10-01T11:59:00.123456789Z',
  )
})

test.each([
  {since: 'tomorrow'},
  {since: '0m'},
  {since: '2h'},
  {until: '2026-10-01'},
  {since: '2026-10-01T12:00:00', until: '2026-10-01T12:30:00Z'},
  {statusCode: '500'},
  {statusCode: '500', types: ['FUNCTION_RUN']},
])('invalid search %j fails before a request', async (input) => {
  await expect(searchLogs({...account, clientId: 'test-app', ...input})).rejects.toThrow()
  expect(executeLogsQuery).not.toHaveBeenCalled()
})
