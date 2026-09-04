import {unifiedConfigurationParserFactory} from './json-schema.js'
import {describe, test, expect} from 'vitest'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

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

  test('falls back to zod parser when no JSON schema is provided', async () => {
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: undefined,
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema)
    const result = parser({type: 'product_subscription'})

    // Then
    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('falls back to zod parser when JSON schema is empty', async () => {
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{}',
      },
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema)
    const result = parser({type: 'product_subscription'})

    // Then
    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('validates with both zod and JSON schema when both succeed', async () => {
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}}}',
      },
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema)
    const result = parser({type: 'product_subscription'})

    // Then
    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('returns errors when zod validation fails', async () => {
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}}}',
      },
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema)
    const result = parser({type: 'invalid'})

    // Then
    expect(result.state).toBe('error')
    expect(result.data).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]).toEqual({path: ['type'], message: 'Invalid type'})
  })

  test('returns errors when JSON schema validation fails', async () => {
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}},"required":["price"]}',
      },
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema)
    const result = parser({type: 'product_subscription'})

    // Then
    expect(result.state).toBe('error')
    expect(result.data).toBeUndefined()
    expect(result.errors).toBeDefined()
    expect(result.errors?.length).toBeGreaterThan(0)
    expect(result.errors?.[0]?.path).toContain('price')
  })

  test('combines errors from both validations', async () => {
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}},"required":["price"]}',
      },
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema)
    const result = parser({type: 'invalid'})

    // Then
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
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"custom":{"type":"string"}}}',
      },
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema)

    // Then - base properties should be accepted
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

  test('falls back to the zod result when the contract fails to compile (e.g. empty enum)', async () => {
    // Given: the shape a server renders when its template registry is empty —
    // an empty enum is invalid JSON Schema and AJV refuses to compile it.
    const invalidContract = JSON.stringify({
      type: 'object',
      properties: {
        metaobjects: {
          type: 'array',
          items: {type: 'string', enum: []},
        },
      },
    })
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, {jsonSchema: invalidContract})
    const mockOutput = mockAndCaptureOutput()
    const result = parser({type: 'product_subscription'})

    // Then: no throw, zod result served, warning emitted once
    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
    expect(mockOutput.warn()).toContain(`The validation schema provided for "${merged.identifier}"`)

    mockOutput.clear()
    parser({type: 'product_subscription'})
    expect(mockOutput.warn()).toBe('')
  })

  test('still reports zod errors when the contract fails to compile', async () => {
    // Given
    const invalidContract = JSON.stringify({
      type: 'object',
      properties: {anything: {type: 'string', enum: []}},
    })
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any, {jsonSchema: invalidContract})
    const result = parser({type: 'invalid'})

    // Then: local validation still gates the config
    expect(result.state).toBe('error')
    expect(result.errors).toEqual([{path: ['type'], message: 'Invalid type'}])
  })

  test('falls back to the zod parser when the contract cannot be normalised (broken $ref)', async () => {
    // Given
    const brokenRefContract = JSON.stringify({
      type: 'object',
      properties: {thing: {$ref: '#/definitions/DoesNotExist'}},
    })
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
    }

    // When
    const mockOutput = mockAndCaptureOutput()
    const parser = await unifiedConfigurationParserFactory(merged as any, {jsonSchema: brokenRefContract})
    const result = parser({type: 'product_subscription'})

    // Then: the factory degrades to the local parser instead of throwing
    expect(parser).toBe(merged.parseConfigurationObject)
    expect(result.state).toBe('ok')
    expect(mockOutput.warn()).toContain(`The validation schema provided for "${merged.identifier}"`)
  })
})
