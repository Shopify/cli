import {presentFunctionExecution} from './result.js'
import {functionRunJsonOutputSchema, type FunctionRunResult} from './types.js'
import {expect, test, vi} from 'vitest'
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

test('preserves native keys and payloads through the stdout writer', async () => {
  const value = {...result(), extra_native_field: {nested_key: true}}
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () =>
      presentFunctionExecution({
        state: 'completed',
        resultJson: JSON.stringify(value),
        exitCode: 0,
        diagnostics: ['Runner warning'],
      }),
    )
    expect(stdout()).toBe(`${JSON.stringify(value)}\n`)
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
        resultJson: JSON.stringify({...result(), success: false}),
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

test.each([0, 1])('preserves observed text stream order with exit code %s', (exitCode) => {
  const writes: {stream: string; data: Buffer}[] = []
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((data) => {
    writes.push({stream: 'stdout', data: Buffer.from(data)})
    return true
  })
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((data) => {
    writes.push({stream: 'stderr', data: Buffer.from(data)})
    return true
  })
  const outputChunks = [
    {stream: 'stderr' as const, data: Buffer.from('Diagnostic\n')},
    {stream: 'stdout' as const, data: Buffer.from('  Output\n\n')},
    {stream: 'stderr' as const, data: Buffer.from('More diagnostics\r\n')},
  ]

  try {
    const present = () =>
      presentFunctionExecution(
        exitCode === 0
          ? {
              state: 'completed-text',
              outputChunks,
            }
          : {
              state: 'failed',
              message: 'Function runner failed with exit code 1.',
              command: '/bin/runner',
              args: [],
              exitCode,
              stderr: 'Diagnostic\nMore diagnostics\r\n',
              outputChunks,
            },
      )
    if (exitCode === 0) present()
    else expect(present).toThrow(ExternalError)
    expect(writes).toEqual(outputChunks)
  } finally {
    stdout.mockRestore()
    stderr.mockRestore()
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

test('publishes a self-contained result schema for help and documentation', () => {
  expect(JSON.stringify(functionRunJsonOutputSchema.jsonSchema)).not.toContain('"$ref"')
  expect(functionRunJsonOutputSchema.jsonSchema).toMatchObject({
    properties: {
      input: {description: 'Native Function input; query keys and values are preserved.'},
      output: {description: 'Native Function output, including the runner-specific invalid-output representation.'},
    },
  })
})
