import {
  renderFunctionInfoResult,
  buildBuildSection,
  buildConfigurationSection,
  buildTargetingSection,
  buildFunctionRunnerSection,
} from './result.js'
import {functionInfoJsonOutputSchema, type FunctionInfoResult} from './types.js'
import {describe, expect, test} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {unstyled} from '@shopify/cli-kit/node/output'

function fixture(): FunctionInfoResult {
  return {
    function: {
      handle: 'my-function',
      name: 'My Function',
      apiVersion: '2024-01',
      directory: '/functions/my-function',
      targets: [
        {
          target: 'purchase.payment-customization.run',
          inputQueryPath: '/functions/my-function/src/input.graphql',
          export: 'run',
        },
      ],
      schemaPath: '/functions/my-function/schema.graphql',
      wasmPath: '/functions/my-function/dist/index.wasm',
      functionRunnerPath: '/bin/function-runner',
    },
  }
}

describe('renderFunctionInfoResult', () => {
  test('writes one encoded JSON object to stdout', async () => {
    const result = fixture()
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      renderFunctionInfoResult(result, 'json')
      expect(stdout()).toBe(`${functionInfoJsonOutputSchema.encode(result)}\n`)
      expect(JSON.parse(stdout())).toEqual(result)
      expect(stderr()).toBe('')
    })
  })

  test('keeps human-readable sections on stderr', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      renderFunctionInfoResult(fixture(), 'text')
      expect(stdout()).toBe('')
      for (const text of [
        'CONFIGURATION',
        'My Function',
        'TARGETING',
        'purchase.payment-customization.run',
        'BUILD',
        'FUNCTION RUNNER',
      ]) {
        expect(unstyled(stderr())).toContain(text)
      }
    })
  })

  test('renders unavailable values as N/A and omits the empty targeting section', async () => {
    const result = fixture()
    result.function.handle = null
    result.function.apiVersion = null
    result.function.schemaPath = null
    result.function.targets = []
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      renderFunctionInfoResult(result, 'json')
      expect(JSON.parse(stdout()).function).toMatchObject({
        handle: null,
        apiVersion: null,
        schemaPath: null,
        targets: [],
      })
      expect(stderr()).toBe('')
    })
    await withCapturedStandardStreams(async ({stderr}) => {
      renderFunctionInfoResult(result, 'text')
      expect(unstyled(stderr())).toContain('N/A')
      expect(unstyled(stderr())).not.toContain('TARGETING')
    })
  })
})

describe('functionInfoJsonOutputSchema', () => {
  test.each([
    {field: 'schemaPath', value: 'relative/schema.graphql'},
    {field: 'wasmPath', value: 'relative/index.wasm'},
    {field: 'directory', value: 'relative/directory'},
    {field: 'functionRunnerPath', value: 'relative/runner'},
    {field: 'targets', value: [{target: 'run', inputQueryPath: 'relative/input.graphql', export: null}]},
    {field: 'targets', value: [{target: 'run', inputQueryPath: null, export: null, unexpected: true}]},
    {field: 'unexpected', value: true},
  ])('rejects invalid $field values', ({field, value}) => {
    const result = fixture()
    expect(() => functionInfoJsonOutputSchema.validate({function: {...result.function, [field]: value}})).toThrow()
  })

  test('rejects unknown root fields', () => {
    expect(() => functionInfoJsonOutputSchema.validate({...fixture(), unexpected: true})).toThrow()
  })

  test.each(['/functions/my-function', 'C:\\functions\\my-function', '\\\\server\\functions\\my-function'])(
    'accepts absolute native paths: %s',
    (directory) => {
      const result = fixture()
      result.function.directory = directory
      expect(functionInfoJsonOutputSchema.validate(result)).toEqual(result)
    },
  )
})

test('preserves text section fields and missing-value presentation', () => {
  expect(buildConfigurationSection({}, 'My Function')).toEqual({
    title: 'CONFIGURATION\n',
    body: {
      tabularData: [
        ['Handle', 'N/A'],
        ['Name', 'My Function'],
        ['API Version', 'N/A'],
      ],
      firstColumnSubdued: true,
    },
  })
  expect(buildBuildSection('/function.wasm')).toEqual({
    title: '\nBUILD\n',
    body: {
      tabularData: [
        ['Schema Path', {filePath: 'N/A'}],
        ['Wasm Path', {filePath: '/function.wasm'}],
      ],
      firstColumnSubdued: true,
    },
  })
  expect(buildTargetingSection({})).toBeNull()
  expect(buildFunctionRunnerSection('/runner')).toEqual({
    title: '\nFUNCTION RUNNER\n',
    body: {tabularData: [['Path', {filePath: '/runner'}]], firstColumnSubdued: true},
  })
})
