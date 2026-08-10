import {functionInfoJsonOutputSchema} from './info-types.js'
import {renderJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {describe, expect, test} from 'vitest'

describe('functionInfoJsonOutputSchema', () => {
  test('accepts the function info JSON result', () => {
    expect(
      functionInfoJsonOutputSchema.schema.safeParse({
        name: 'My Function',
        targeting: {
          'purchase.payment-customization.run': {
            inputQueryPath: '/path/to/query.graphql',
            export: 'run',
          },
        },
        wasmPath: '/path/to/function.wasm',
        functionRunnerPath: '/path/to/runner',
      }).success,
    ).toBe(true)
  })

  test('renders the named result and targeting types', () => {
    expect(renderJsonOutputSchema(functionInfoJsonOutputSchema)).toBe(`interface FunctionInfoResult {
  handle?: string
  name: string
  apiVersion?: string
  targeting: Record<string, FunctionTargeting>
  schemaPath?: string
  wasmPath: string
  functionRunnerPath: string
}

interface FunctionTargeting {
  inputQueryPath?: string
  export?: string
}`)
  })
})
