import {functionInfo} from './info.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'
// Public artifact paths use native separators rather than CLI Kit's normalized paths.
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

describe('functionInfo', () => {
  test('returns the configured function projection without terminal formatting', async () => {
    const extension = await testFunctionExtension({
      dir: '/path/to/function',
      config: {
        name: 'My Function',
        type: 'function',
        handle: 'my-function',
        api_version: '2024-01',
        configuration_ui: false,
        targeting: [
          {target: 'purchase.payment-customization.run', input_query: 'src/input.graphql', export: 'run'},
          {target: 'purchase.checkout.delivery-customization.run'},
        ],
      },
    })

    expect(
      functionInfo(extension, {functionRunnerPath: '/path/to/runner', schemaPath: '/path/to/schema.graphql'}),
    ).toEqual({
      function: {
        handle: 'my-function',
        name: 'My Function',
        apiVersion: '2024-01',
        directory: resolve('/path/to/function'),
        targets: [
          {
            target: 'purchase.payment-customization.run',
            inputQueryPath: resolve('/path/to/function/src/input.graphql'),
            export: 'run',
          },
          {target: 'purchase.checkout.delivery-customization.run', inputQueryPath: null, export: null},
        ],
        schemaPath: resolve('/path/to/schema.graphql'),
        wasmPath: resolve(extension.outputPath),
        functionRunnerPath: resolve('/path/to/runner'),
      },
    })
  })

  test('uses the configured build path for the WASM artifact', async () => {
    const extension = await testFunctionExtension({dir: '/path/to/function'})
    extension.configuration.build!.path = 'custom/output.wasm'
    const result = functionInfo(extension, {functionRunnerPath: '/path/to/runner'})
    expect(result.function.wasmPath).toBe(resolve('/path/to/function/custom/output.wasm'))
  })

  test('returns null for unavailable fields and an empty targets array', async () => {
    const extension = await testFunctionExtension({dir: '/path/to/function'})
    delete extension.configuration.handle
    Reflect.deleteProperty(extension.configuration, 'api_version')
    delete extension.configuration.targeting
    const result = functionInfo(extension, {functionRunnerPath: '/path/to/runner'})
    expect(result.function).toMatchObject({handle: null, apiVersion: null, schemaPath: null, targets: []})
  })
})
