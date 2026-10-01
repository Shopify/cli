import Logs from './logs.js'
import {executeLogsQuery, logsJsonOutputSchema} from '../../services/logs-query.js'
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
])('rejects unsupported or conflicting flags %j', async ({args}) => {
  await expect(Parser.parse(args, {flags: Logs.flags})).rejects.toThrow()
})

test.each([
  '--client-id',
  '--app',
  '--path',
  '--config',
  '--type',
  '--since',
  '--until',
  '--limit',
  '--shop',
  '--status-code',
  '--sort',
  '--offset',
])('rejects the removed search flag %s', async (flag) => {
  await expect(Parser.parse(['--query', '{ __typename }', flag, 'unused'], {flags: Logs.flags})).rejects.toThrow(
    `Nonexistent flag: ${flag}`,
  )
})

test('requires an explicit GraphQL document', async () => {
  await expect(Parser.parse([], {flags: Logs.flags})).rejects.toThrow('Exactly one of the following must be provided')
})

test.each(['--variables', '--variable-file', '--operation-name'])(
  'rejects %s without a GraphQL document',
  async (flag) => {
    await expect(Parser.parse([flag, 'unused'], {flags: Logs.flags})).rejects.toThrow()
  },
)
