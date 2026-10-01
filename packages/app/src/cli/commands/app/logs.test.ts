import Logs from './logs.js'
import {executeLogsQuery, logsJsonOutputSchema} from '../../services/logs-query.js'
import {searchLogs} from '../../services/logs-search.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {Parser} from '@oclif/core'

vi.mock('../../services/logs-query.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/logs-query.js')>()),
  executeLogsQuery: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

vi.mock('../../services/logs-search.js')

const originalExitCode = process.exitCode

beforeEach(() => {
  process.exitCode = undefined
})

afterEach(() => {
  process.exitCode = originalExitCode
})

test.each([{flags: []}, {flags: ['--json']}])('prints the full JSON response with flags %j', async ({flags}) => {
  const query = '{ __schema { queryType { name } } }'
  const response = {data: {__schema: {queryType: {name: 'QueryRoot'}}}, extensions: {requestId: 'example'}}
  vi.mocked(executeLogsQuery).mockResolvedValue({response, failed: false})

  await Logs.run(['--query', query, ...flags], import.meta.url)

  expect(executeLogsQuery).toHaveBeenCalledExactlyOnceWith({
    query,
    queryFile: undefined,
    variables: undefined,
    variableFile: undefined,
    operationName: undefined,
    noPrompt: false,
    demo: false,
  })
  expect(outputResult).toHaveBeenCalledExactlyOnceWith(JSON.stringify(response, null, 2))
  expect(process.exitCode).toBeUndefined()
})

test('forwards stdin, variables, operation name and local demo selection', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({response: {data: {app: null}}, failed: false})

  await Logs.run(
    ['--query-file', '-', '--variables', '{"key":"test-app"}', '--operation-name', 'Logs', '--demo', '--no-prompt'],
    import.meta.url,
  )

  expect(executeLogsQuery).toHaveBeenCalledExactlyOnceWith({
    query: undefined,
    queryFile: '-',
    variables: '{"key":"test-app"}',
    variableFile: undefined,
    operationName: 'Logs',
    noPrompt: true,
    demo: true,
  })
})

test('forwards file paths', async () => {
  vi.mocked(executeLogsQuery).mockResolvedValue({response: {data: null}, failed: false})

  await Logs.run(['--query-file', 'logs.graphql', '--variable-file', 'variables.json'], import.meta.url)

  expect(executeLogsQuery).toHaveBeenCalledWith(
    expect.objectContaining({queryFile: 'logs.graphql', variableFile: joinPath(cwd(), 'variables.json')}),
  )
})

test('preserves partial data and errors while setting a failing exit status', async () => {
  const response = {data: {app: null}, errors: [{message: 'Access denied', path: ['app']}]}
  vi.mocked(executeLogsQuery).mockResolvedValue({response, failed: true})

  await Logs.run(['--query', '{ app(key: "test-app") { key } }'], import.meta.url)

  expect(outputResult).toHaveBeenCalledExactlyOnceWith(JSON.stringify(response, null, 2))
  expect(process.exitCode).toBe(1)
})

test('defines JSON output and account selection', async () => {
  expect(Logs.jsonOutputSchema).toBe(logsJsonOutputSchema)
  const parsed = await Parser.parse(['--auth-alias', 'demo', '--query', '{ __typename }'], {
    flags: {...Logs.baseFlags, ...Logs.flags},
  })
  expect(parsed.flags['auth-alias']).toBe('demo')
})

test.each([
  {args: ['--api', 'unknown', '--query', '{ __typename }']},
  {args: ['--query', '{ __typename }', '--query-file', 'query.graphql']},
  {args: ['--query', '{ __typename }', '--variables', '{}', '--variable-file', 'variables.json']},
  {args: ['--query', '{ __typename }', '--since', '15m']},
  {args: ['--query-file', 'query.graphql', '--type', 'WEBHOOK_DELIVERY']},
  {args: ['--client-id', 'one', '--app', 'two']},
  {args: ['--limit', '0']},
  {args: ['--offset', '10']},
  {args: ['--query', '{ __typename }', '--client-id', 'test-app']},
])('rejects conflicting, missing or convenience flags %j', async ({args}) => {
  await expect(Parser.parse(args, {flags: Logs.flags})).rejects.toThrow()
})

test('filter mode defaults to the current project without requiring a query', async () => {
  const response = {data: {app: {logs: {appKey: 'project-app', events: []}}}}
  vi.mocked(searchLogs).mockResolvedValue({response, failed: false})
  await Logs.run([], import.meta.url)
  expect(searchLogs).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({clientId: undefined, noPrompt: false}))
  expect(executeLogsQuery).not.toHaveBeenCalled()
  expect(outputResult).toHaveBeenCalledExactlyOnceWith(JSON.stringify(response, null, 2))
})

test('filter mode accepts an explicit app and bounded search', async () => {
  vi.mocked(searchLogs).mockResolvedValue({response: {data: null}, failed: false})
  await Logs.run(
    ['--app', 'selected-app', '--type', 'WEBHOOK_DELIVERY', '--since', '15m', '--limit', '10', '--status-code', '500'],
    import.meta.url,
  )
  expect(searchLogs).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      clientId: 'selected-app',
      types: ['WEBHOOK_DELIVERY'],
      since: '15m',
      limit: 10,
      statusCode: '500',
    }),
  )
})

test.each(['--variables', '--variable-file', '--operation-name'])(
  'rejects %s without a GraphQL document',
  async (flag) => {
    await expect(Parser.parse([flag, 'unused'], {flags: Logs.flags})).rejects.toThrow()
    expect(searchLogs).not.toHaveBeenCalled()
  },
)
