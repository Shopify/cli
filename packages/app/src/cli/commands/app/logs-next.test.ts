import LogsNext from './logs-next.js'
import {retrieveLogs} from '../../services/historical-logs/service.js'
import {prepareLogInput} from '../../services/historical-logs/input.js'
import {logsOutput} from '../../services/historical-logs/types.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../services/historical-logs/service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/historical-logs/service.js')>()),
  retrieveLogs: vi.fn(),
}))

afterEach(() => {
  mockAndCaptureOutput().clear()
  process.exitCode = 0
})

function result(status: 'success' | 'partial' = 'success') {
  return {
    status,
    query: {
      clientId: 'test-app',
      types: ['webhook'],
      since: '2026-10-06T13:00:00Z',
      until: '2026-10-06T14:00:00Z',
      anchor: '2026-10-06T14:00:00Z',
      clockSource: 'scope-response' as const,
      limit: 20,
    },
    logs: [],
    ordering: 'none' as const,
    pageInfo: {limit: 20, returnedCount: 0, limitReached: false, moreRecordsMatched: null},
    errors: status === 'partial' ? [{code: 'PARTIAL_RESULT', message: 'One shard failed'}] : [],
    limitations: ['Unordered results; additional matching records may exist.'],
  }
}

test('parses repeatable space/equals forms and forwards effective defaults', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await new LogsNext(['--client-id=explicit-app', '--type', 'webhook', '--type=webhook'], await Config.load()).run()
  expect(retrieveLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      'client-id': 'explicit-app',
      type: ['webhook', 'webhook'],
      since: '1h',
      limit: 20,
    }),
  )
  expect(prepareLogInput(vi.mocked(retrieveLogs).mock.calls[0]![0]).types).toEqual(['webhook'])
  expect(mockAndCaptureOutput().output()).toContain('Unordered results; additional matching records may exist.')
})

test.each([
  ['--client-id', 'one', '--client-id=two'],
  ['--since', '1h', '--since=2h'],
  ['--until', '2026-10-06T13:00:00Z', '--until=2026-10-06T14:00:00Z'],
  ['--limit', '10', '--limit=20'],
])('rejects repeated singular flags %j before authentication', async (...argv) => {
  await expect(new LogsNext(argv, await Config.load()).run()).rejects.toThrow('can only be specified once')
  expect(retrieveLogs).not.toHaveBeenCalled()
})

test.each([
  {argv: ['--json'], json: true, noInput: false},
  {argv: ['--no-input'], json: false, noInput: true},
  {argv: ['--json', '--no-input'], json: true, noInput: true},
])('keeps JSON and no-input independent ($argv)', async ({argv, json, noInput}) => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await new LogsNext(argv, await Config.load()).run()
  expect(vi.mocked(retrieveLogs).mock.calls[0]![0]['no-input'] ?? false).toBe(noInput)
  expect(mockAndCaptureOutput().output().startsWith('{')).toBe(json)
  if (json) expect(JSON.parse(mockAndCaptureOutput().output())).toEqual(result())
})

test('emits one partial document and sets a nonzero exit status', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result('partial'))
  await new LogsNext(['--json', '--no-input'], await Config.load()).run()
  expect(JSON.parse(mockAndCaptureOutput().output())).toMatchObject({
    status: 'partial',
    errors: [{code: 'PARTIAL_RESULT'}],
  })
  expect(process.exitCode).toBe(1)
})

test('publishes the finite result and event output schema', () => {
  expect(LogsNext.jsonOutputSchema).toBe(logsOutput)
  expect(LogsNext.descriptionForHelp()).toContain('HistoricalAppLogs')
})
