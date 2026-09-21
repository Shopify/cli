import Execute from './execute.js'
import {executeAppLogsOperation} from '../../services/dev/execute.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {Parser} from '@oclif/core'

vi.mock('../../services/dev/execute.js')
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

test('forwards a GraphQL request without an app project or log-specific flags and prints the full response', async () => {
  const query = '{ __schema { queryType { name } } }'
  const response = {data: {__schema: {queryType: {name: 'QueryRoot'}}}}
  vi.mocked(executeAppLogsOperation).mockResolvedValue({response, failed: false})

  await Execute.run(['--query', query], import.meta.url)

  expect(executeAppLogsOperation).toHaveBeenCalledWith({
    query,
    queryFile: undefined,
    variables: undefined,
    variableFile: undefined,
    operationName: undefined,
    demo: false,
  })
  expect(outputResult).toHaveBeenCalledExactlyOnceWith(JSON.stringify(response, null, 2))
  expect(process.exitCode).toBeUndefined()
})

test('forwards stdin, variables, operation name and the local demo selection', async () => {
  vi.mocked(executeAppLogsOperation).mockResolvedValue({response: {data: {app: null}}, failed: false})

  await Execute.run(
    ['--query-file', '-', '--variables', '{"key":"test-app"}', '--operation-name', 'Logs', '--demo'],
    import.meta.url,
  )

  expect(executeAppLogsOperation).toHaveBeenCalledWith({
    query: undefined,
    queryFile: '-',
    variables: '{"key":"test-app"}',
    variableFile: undefined,
    operationName: 'Logs',
    demo: true,
  })
})

test('preserves partial data and errors in stdout while setting a failing exit status', async () => {
  const response = {data: {app: null}, errors: [{message: 'Access denied', path: ['app']}]}
  vi.mocked(executeAppLogsOperation).mockResolvedValue({response, failed: true})

  await Execute.run(['--query', '{ app(key: "test-app") { key } }'], import.meta.url)

  expect(outputResult).toHaveBeenCalledExactlyOnceWith(JSON.stringify(response, null, 2))
  expect(process.exitCode).toBe(1)
})

test.each([
  {args: []},
  {args: ['--query', '{ __typename }', '--query-file', 'query.graphql']},
  {args: ['--query', '{ __typename }', '--variables', '{}', '--variable-file', 'variables.json']},
  {args: ['--query', '{ __typename }', '--minutes', '15']},
  {args: ['--query', '{ __typename }', '--client-id', 'test-app']},
  {args: ['--query', '{ __typename }', '--list-filters']},
])('rejects conflicting, missing or log-specific flags %j', async ({args}) => {
  await expect(Parser.parse(args, {flags: Execute.flags})).rejects.toThrow()
})
