import {discoverLogs} from './logs-discovery.js'
import {executeLogsQuery} from './logs-query.js'
import {expect, test, vi} from 'vitest'

vi.mock('./logs-query.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./logs-query.js')>()),
  executeLogsQuery: vi.fn(),
}))

const options = {clientId: 'test-app', noPrompt: true, demo: false, json: false}

test('type discovery renders names and descriptions from the API', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({
    response: {data: {__type: {enumValues: [{name: 'WEBHOOK_DELIVERY', description: 'Webhook delivery summary.'}]}}},
    failed: false,
  })
  await expect(discoverLogs({...options, kind: 'types'})).resolves.toEqual({
    output: 'WEBHOOK_DELIVERY  Webhook delivery summary.',
    failed: false,
  })
  expect(JSON.parse(vi.mocked(executeLogsQuery).mock.calls[0]![0].variables!)).toEqual({appKey: 'test-app'})
})

test('filter discovery explains applicable operators without querying logs', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({
    response: {
      data: {
        app: {
          logFilterDefinitions: [
            {field: 'TARGET', description: 'Webhook topic.', operators: ['EQUALS', 'IN'], valueType: 'STRING'},
          ],
        },
      },
    },
    failed: false,
  })
  await expect(discoverLogs({...options, kind: 'filters', types: ['WEBHOOK_DELIVERY']})).resolves.toEqual({
    output: 'TARGET (STRING; EQUALS, IN)\n  Webhook topic.',
    failed: false,
  })
  const request = vi.mocked(executeLogsQuery).mock.calls[0]![0]
  expect(JSON.parse(request.variables!)).toEqual({appKey: 'test-app', types: ['WEBHOOK_DELIVERY']})
  expect(request.query).not.toContain('logs(input:')
})

test.each([true, false])('API errors are preserved in either output format (%s)', async (json) => {
  const response = {data: {app: null}, errors: [{message: 'Access denied'}]}
  vi.mocked(executeLogsQuery).mockResolvedValue({response, failed: true})
  await expect(discoverLogs({...options, kind: 'filters', json})).resolves.toEqual({
    output: JSON.stringify(response, null, 2),
    failed: true,
  })
})

test('JSON discovery preserves the full response', async () => {
  const response = {data: {__type: {enumValues: []}}, extensions: {requestId: 'one'}}
  vi.mocked(executeLogsQuery).mockResolvedValue({response, failed: false})
  await expect(discoverLogs({...options, kind: 'types', json: true})).resolves.toEqual({
    output: JSON.stringify(response, null, 2),
    failed: false,
  })
})

test('malformed discovery does not look like an empty result', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({response: {data: {app: null}}, failed: false})
  await expect(discoverLogs({...options, kind: 'filters'})).rejects.toThrow()
})
