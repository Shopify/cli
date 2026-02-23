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
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: undefined,
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({type: 'product_subscription'})

    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('falls back to zod parser when JSON schema is empty', async () => {
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{}',
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({type: 'product_subscription'})

    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('validates with both zod and JSON schema when both succeed', async () => {
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}}}',
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({type: 'product_subscription'})

    expect(result).toEqual({
      state: 'ok',
      data: {type: 'product_subscription'},
      errors: undefined,
    })
  })

  test('returns errors when zod validation fails', async () => {
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}}}',
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({type: 'invalid'})

    expect(result.state).toBe('error')
    expect(result.data).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]).toEqual({path: ['type'], message: 'Invalid type'})
  })

  test('returns errors when JSON schema validation fails', async () => {
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}},"required":["price"]}',
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({type: 'product_subscription'})

    expect(result.state).toBe('error')
    expect(result.data).toBeUndefined()
    expect(result.errors).toBeDefined()
    expect(result.errors?.length).toBeGreaterThan(0)
    expect(result.errors?.[0]?.path).toContain('price')
  })

  test('combines errors from both validations', async () => {
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"type":{"type":"string"}},"required":["price"]}',
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
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

  test('transforms data to server format before contract validation', async () => {
    // Given: Zod outputs TOML-shaped data, but the contract expects server-shaped data
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: (config: any) => ({
        state: 'ok' as const,
        data: {access_scopes: {scopes: config.access_scopes?.scopes}},
        errors: undefined,
      }),
      transformLocalToRemote: (local: any) => ({
        scopes: local.access_scopes?.scopes,
      }),
      validationSchema: {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {scopes: {type: 'string'}},
          required: ['scopes'],
        }),
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({access_scopes: {scopes: 'read_products'}})

    expect(result.state).toBe('ok')
  })

  test('returns Zod-validated data, not contract-stripped data', async () => {
    // Given: Zod outputs TOML-shaped data, transform converts to server-shaped for validation
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: (config: any) => ({
        state: 'ok' as const,
        data: {access_scopes: {scopes: config.access_scopes?.scopes}},
        errors: undefined,
      }),
      transformLocalToRemote: (local: any) => ({
        scopes: local.access_scopes?.scopes,
      }),
      validationSchema: {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {scopes: {type: 'string'}},
        }),
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({access_scopes: {scopes: 'read_products'}})

    expect(result.state).toBe('ok')
    expect(result.data).toEqual({access_scopes: {scopes: 'read_products'}})
  })

  test('falls back to raw data when no transform is available', async () => {
    // Given: no transformLocalToRemote, contract matches raw shape
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {type: {type: 'string'}},
        }),
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({type: 'product_subscription'})

    expect(result.state).toBe('ok')
    expect(result.data).toEqual({type: 'product_subscription'})
  })

  test('contract cannot strip fields from returned data', async () => {
    // Given: Zod output has extra_field, contract doesn't define it, strip mode is on
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: (config: any) => ({
        state: 'ok' as const,
        data: {...config, extra_field: 'preserved'},
        errors: undefined,
      }),
      validationSchema: {
        jsonSchema: JSON.stringify({
          type: 'object',
          properties: {type: {type: 'string'}},
        }),
      },
    }

    // When: strip mode (default)
    const parser = await unifiedConfigurationParserFactory(merged as any)
    const result = parser({type: 'product_subscription'})

    // Then: extra_field survives because we return Zod data, not contract-processed data
    expect(result.state).toBe('ok')
    expect(result.data).toEqual({type: 'product_subscription', extra_field: 'preserved'})
  })

  test('adds base properties to the JSON schema', async () => {
    const merged = {
      identifier: randomUUID(),
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema: '{"type":"object","properties":{"custom":{"type":"string"}}}',
      },
    }

    const parser = await unifiedConfigurationParserFactory(merged as any)

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
