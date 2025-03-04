import {unifiedConfigurationParserFactory} from './json-schema.js'
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

  test('falls back to zod parser when no JSON schema is provided', async () => {
    // Given
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: undefined,
    }

    // When
    const parser = await unifiedConfigurationParserFactory(merged as any)
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
    const parser = await unifiedConfigurationParserFactory(merged as any)
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
    const parser = await unifiedConfigurationParserFactory(merged as any)
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
    const parser = await unifiedConfigurationParserFactory(merged as any)
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
    const parser = await unifiedConfigurationParserFactory(merged as any)
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
    const parser = await unifiedConfigurationParserFactory(merged as any)
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
    const parser = await unifiedConfigurationParserFactory(merged as any)

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
})
