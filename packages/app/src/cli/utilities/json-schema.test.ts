import {unifiedConfigurationParserFactory} from './json-schema.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {FlattenedRemoteSpecification} from '../api/graphql/extension_specifications.js'
import {describe, test, expect} from 'vitest'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

describe('unifiedConfigurationParserFactory', () => {
  const mockParseConfigurationObject = (config: any) => {
    if (config.type === 'invalid') {
      return {
        state: 'error' as const,
        data: undefined,
        errors: [{path: ['type'], message: 'Invalid type'}],
      }
    }
    return {
      state: 'ok' as const,
      data: config,
      errors: undefined,
    }
  }

  function buildTestInputs(validationSchema?: {jsonSchema: string} | undefined | null) {
    const spec = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
    } as unknown as ExtensionSpecification & {loadedRemoteSpecs: true}
    const remoteSpec = {
      validationSchema,
    } as unknown as FlattenedRemoteSpecification
    return {spec, remoteSpec}
  }

  test('falls back to zod parser when no JSON schema is provided', async () => {
    const {spec, remoteSpec} = buildTestInputs(undefined)

    const parser = await unifiedConfigurationParserFactory(spec, remoteSpec)
    const result = parser({type: 'product_subscription'})

    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('falls back to zod parser when JSON schema is empty', async () => {
    const {spec, remoteSpec} = buildTestInputs({jsonSchema: '{}'})

    const parser = await unifiedConfigurationParserFactory(spec, remoteSpec)
    const result = parser({type: 'product_subscription'})

    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('validates with both zod and JSON schema when both succeed', async () => {
    const {spec, remoteSpec} = buildTestInputs({
      jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}}}',
    })

    const parser = await unifiedConfigurationParserFactory(spec, remoteSpec)
    const result = parser({type: 'product_subscription'})

    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('returns errors when zod validation fails', async () => {
    const {spec, remoteSpec} = buildTestInputs({
      jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}}}',
    })

    const parser = await unifiedConfigurationParserFactory(spec, remoteSpec)
    const result = parser({type: 'invalid'})

    expect(result.state).toBe('error')
    expect(result.data).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]).toEqual({path: ['type'], message: 'Invalid type'})
  })

  test('returns errors when JSON schema validation fails', async () => {
    const {spec, remoteSpec} = buildTestInputs({
      jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}},"required":["price"]}',
    })

    const parser = await unifiedConfigurationParserFactory(spec, remoteSpec)
    const result = parser({type: 'product_subscription'})

    expect(result.state).toBe('error')
    expect(result.data).toBeUndefined()
    expect(result.errors).toBeDefined()
    expect(result.errors?.length).toBeGreaterThan(0)
    expect(result.errors?.[0]?.path).toContain('price')
  })

  test('combines errors from both validations', async () => {
    const {spec, remoteSpec} = buildTestInputs({
      jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}},"required":["price"]}',
    })

    const parser = await unifiedConfigurationParserFactory(spec, remoteSpec)
    const result = parser({type: 'invalid'})

    expect(result.state).toBe('error')
    expect(result.data).toBeUndefined()
    expect(result.errors).toBeDefined()
    expect(result.errors?.length).toBeGreaterThan(1)

    // Should have both the zod error and the JSON schema error
    const typeError = result.errors?.find((error) => error.path.includes('type'))
    const priceError = result.errors?.find((error) => error.path.includes('price'))
    expect(typeError).toBeDefined()
    expect(priceError).toBeDefined()
  })

  test('adds base properties to the JSON schema', async () => {
    const {spec, remoteSpec} = buildTestInputs({
      jsonSchema: '{"type":"object","properties":{"custom":{"type":"string"}}}',
    })

    const parser = await unifiedConfigurationParserFactory(spec, remoteSpec)

    // base properties should be accepted
    const result = parser({
      type: 'product_subscription',
      handle: 'test-handle',
      uid: 'test-uid',
      path: 'test-path',
      extensions: {},
      custom: 'value',
    })

    expect(result.state).toBe('ok')
    expect(result.data).toEqual({
      type: 'product_subscription',
      handle: 'test-handle',
      uid: 'test-uid',
      path: 'test-path',
      extensions: {},
      custom: 'value',
    })
  })
})
