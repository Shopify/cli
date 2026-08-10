import {
  buildBuildSection,
  buildConfigurationSection,
  buildTargetingSection,
  buildTextFormatSections,
  encodeFunctionInfoJson,
} from './info-result.js'
import {type FunctionInfoResult} from './info-types.js'
import {describe, expect, test} from 'vitest'

const result: FunctionInfoResult = {
  handle: 'my-function',
  name: 'My Function',
  apiVersion: '2024-01',
  targeting: {
    'purchase.payment-customization.run': {
      inputQueryPath: '/path/to/function/query.graphql',
      export: 'run',
    },
  },
  schemaPath: '/path/to/schema.graphql',
  wasmPath: '/path/to/function.wasm',
  functionRunnerPath: '/path/to/runner',
}

describe('function info result presentation', () => {
  test('encodes a JSON document that matches the declared schema', () => {
    expect(JSON.parse(encodeFunctionInfoJson(result))).toEqual(result)
  })

  test('omits absent optional fields from the JSON document', () => {
    const requiredResult: FunctionInfoResult = {
      name: result.name,
      targeting: result.targeting,
      wasmPath: result.wasmPath,
      functionRunnerPath: result.functionRunnerPath,
    }

    expect(JSON.parse(encodeFunctionInfoJson(requiredResult))).toEqual(requiredResult)
  })

  test('builds configuration rows from the result', () => {
    expect(buildConfigurationSection(result).body).toMatchObject({
      tabularData: [
        ['Handle', 'my-function'],
        ['Name', 'My Function'],
        ['API Version', '2024-01'],
      ],
      firstColumnSubdued: true,
    })
  })

  test('builds targeting rows from the result', () => {
    const section = buildTargetingSection(result.targeting)

    expect(section?.title).toBe('\nTARGETING\n')
    expect((section?.body as {tabularData: unknown[][]}).tabularData).toHaveLength(3)
  })

  test('omits the targeting section when there are no targets', () => {
    expect(buildTargetingSection({})).toBeUndefined()
  })

  test('builds path rows from the result', () => {
    expect(buildBuildSection(result).body).toMatchObject({
      tabularData: [
        ['Schema Path', {filePath: '/path/to/schema.graphql'}],
        ['Wasm Path', {filePath: '/path/to/function.wasm'}],
      ],
    })
  })

  test('builds every text section', () => {
    expect(buildTextFormatSections(result).map((section) => section.title)).toEqual([
      'CONFIGURATION\n',
      '\nTARGETING\n',
      '\nBUILD\n',
      '\nFUNCTION RUNNER\n',
    ])
  })
})
