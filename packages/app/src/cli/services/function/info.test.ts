import {buildTargetingData, functionInfo} from './info.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('functionInfo', () => {
  test('returns the function information as a typed result', async () => {
    const extension = await testFunctionExtension({
      dir: '/path/to/function',
      config: {
        name: 'My Function',
        type: 'function',
        handle: 'my-function',
        api_version: '2024-01',
        configuration_ui: false,
      },
    })

    const result = functionInfo(extension, {
      functionRunnerPath: '/path/to/runner',
      schemaPath: '/path/to/schema.graphql',
    })

    expect(result).toEqual({
      handle: 'my-function',
      name: 'My Function',
      apiVersion: '2024-01',
      targeting: {},
      schemaPath: '/path/to/schema.graphql',
      wasmPath: extension.outputPath,
      functionRunnerPath: '/path/to/runner',
    })
  })

  test('uses build.path for the WASM path when present', async () => {
    const extension = await testFunctionExtension({
      dir: '/path/to/function',
      config: {
        name: 'My Function',
        type: 'function',
        handle: 'my-function',
        api_version: '2024-01',
        configuration_ui: false,
        build: {path: 'custom/output.wasm', wasm_opt: false},
      },
    })

    const result = functionInfo(extension, {functionRunnerPath: '/path/to/runner'})

    expect(result.wasmPath).toBe('/path/to/function/custom/output.wasm')
  })
})

describe('buildTargetingData', () => {
  test('maps targeting paths relative to the function directory', () => {
    const result = buildTargetingData(
      {
        targeting: [
          {
            target: 'purchase.payment-customization.run',
            input_query: 'query.graphql',
            export: 'run',
          },
        ],
      },
      '/path/to/function',
    )

    expect(result).toEqual({
      'purchase.payment-customization.run': {
        inputQueryPath: '/path/to/function/query.graphql',
        export: 'run',
      },
    })
  })

  test.each([
    {
      target: {target: 'purchase.payment-customization.run', export: 'run'},
      expected: {export: 'run'},
    },
    {
      target: {target: 'purchase.payment-customization.run', input_query: 'query.graphql'},
      expected: {inputQueryPath: '/path/to/function/query.graphql'},
    },
  ])('omits targeting fields that are not configured', ({target, expected}) => {
    expect(buildTargetingData({targeting: [target]}, '/path/to/function')).toEqual({
      'purchase.payment-customization.run': expected,
    })
  })
})
