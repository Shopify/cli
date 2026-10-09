import {presentFunctionExecution} from './result.js'
import {functionRunJsonOutputSchema, type FunctionRunResult} from './types.js'
import {expect, test} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {ExternalError} from '@shopify/cli-kit/node/error'

function result(): FunctionRunResult {
  return {
    name: 'discount.wasm',
    size: 12,
    memory_usage: 64,
    instructions: 1000,
    logs: '',
    input: {cart: {lines: []}},
    output: {operations: []},
    success: true,
  }
}

test('preserves native keys and payloads through the real encoder and stdout writer', async () => {
  const value = {...result(), extra_native_field: {nested_key: true}}
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () =>
      presentFunctionExecution({state: 'completed', result: value, exitCode: 0, diagnostics: ['Runner warning']}),
    )
    expect(stdout()).toBe(`${functionRunJsonOutputSchema.encode(value)}\n`)
    expect(JSON.parse(stdout())).toEqual(value)
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: 'Runner warning'})
  })
})

test('prints one failed execution result and retains its nonzero exit code', async () => {
  const previousExitCode = process.exitCode
  try {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      presentFunctionExecution({
        state: 'completed',
        result: {...result(), success: false},
        exitCode: 1,
        diagnostics: [],
      })
      expect(JSON.parse(stdout())).toEqual({...result(), success: false})
      expect(stderr()).toBe('')
      expect(process.exitCode).toBe(1)
    })
  } finally {
    // Tests run serially and restore the process state after the captured callback.
    // eslint-disable-next-line require-atomic-updates
    process.exitCode = previousExitCode
  }
})

test('throws an external failure before writing a result', async () => {
  await withCapturedStandardStreams(async ({stdout}) => {
    expect(() =>
      presentFunctionExecution({
        state: 'failed',
        message: 'Invalid WASM',
        command: '/bin/runner',
        args: ['--json'],
        exitCode: 1,
        stderr: 'Invalid WASM',
      }),
    ).toThrow(ExternalError)
    expect(stdout()).toBe('')
  })
})

test.each(
  [null, {}, [], {error: 'Invalid output', stdout: 'bad output'}, {snake_case: [true, 0]}].map((output) => ({output})),
)('preserves native output values: %j', ({output}) => {
  expect(JSON.parse(functionRunJsonOutputSchema.encode({...result(), output})).output).toEqual(output)
})

test.each([
  {field: 'instructions', value: -1},
  {field: 'size', value: 1.5},
  {field: 'memory_usage', value: -1},
  {field: 'success', value: 'false'},
  {field: 'input', value: undefined},
  {field: 'output', value: undefined},
])('rejects invalid native $field values', ({field, value}) => {
  expect(() => functionRunJsonOutputSchema.validate({...result(), [field]: value})).toThrow()
})

test('requires input and output in its discoverable schema', () => {
  expect(functionRunJsonOutputSchema.jsonSchema).toMatchObject({required: expect.arrayContaining(['input', 'output'])})
})
