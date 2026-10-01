import LogsSchema from './schema.js'
import {fetchLogsSchema} from '../../../services/logs-schema.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {afterEach, expect, test, vi} from 'vitest'
import {Parser} from '@oclif/core'

vi.mock('../../../services/logs-schema.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
})

test('prints SDL for the selected app without requiring a query', async () => {
  vi.mocked(fetchLogsSchema).mockResolvedValue({output: 'type Query { ping: String }', failed: false})
  await LogsSchema.run(['--client-id', 'test-app'], import.meta.url)
  expect(fetchLogsSchema).toHaveBeenCalledExactlyOnceWith({
    appKey: 'test-app',
    noPrompt: false,
    demo: false,
    json: false,
  })
  expect(outputResult).toHaveBeenCalledExactlyOnceWith('type Query { ping: String }')
})

test('forwards app, JSON and authentication options', async () => {
  vi.mocked(fetchLogsSchema).mockResolvedValue({output: '{"data":{}}', failed: false})
  await LogsSchema.run(['--client-id', 'test-app', '--json', '--demo', '--no-prompt'], import.meta.url)
  expect(fetchLogsSchema).toHaveBeenCalledExactlyOnceWith({
    appKey: 'test-app',
    noPrompt: true,
    demo: true,
    json: true,
  })
  expect(outputResult).toHaveBeenCalledExactlyOnceWith('{"data":{}}')
})

test('prints API errors with a failing exit status', async () => {
  vi.mocked(fetchLogsSchema).mockResolvedValue({output: '{"errors":[{"message":"Denied"}]}', failed: true})
  await LogsSchema.run(['--client-id', 'test-app'], import.meta.url)
  expect(outputResult).toHaveBeenCalledExactlyOnceWith('{"errors":[{"message":"Denied"}]}')
  expect(process.exitCode).toBe(1)
})

test.each([
  {args: ['--api', 'unknown']},
  {args: ['--query', '{ __typename }']},
  {args: ['--variables', '{}', '--variable-file', 'variables.json']},
])('rejects unsupported or conflicting flags: %j', async ({args}) => {
  await expect(Parser.parse(args, {flags: LogsSchema.flags})).rejects.toThrow()
})
