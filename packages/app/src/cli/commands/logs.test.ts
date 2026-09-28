import Logs from './logs.js'
import {executeLogsQuery, logsJsonOutputSchema} from '../services/logs-query.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {Parser} from '@oclif/core'

vi.mock('../services/logs-query.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/logs-query.js')>()),
  executeLogsQuery: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

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
    api: 'app-logs',
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
    api: 'app-logs',
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
  {args: []},
  {args: ['--query', '{ __typename }', '--query-file', 'query.graphql']},
  {args: ['--query', '{ __typename }', '--variables', '{}', '--variable-file', 'variables.json']},
  {args: ['--query', '{ __typename }', '--minutes', '15']},
  {args: ['--query', '{ __typename }', '--client-id', 'test-app']},
])('rejects conflicting, missing or convenience flags %j', async ({args}) => {
  await expect(Parser.parse(args, {flags: Logs.flags})).rejects.toThrow()
})
