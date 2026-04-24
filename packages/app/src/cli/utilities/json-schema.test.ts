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

  test('scopes validation to the section contents for configuration specs when identifier matches a key in the config', async () => {
    // Given: A contract-based config spec (like purchase_options) where the JSON schema
    // describes the section contents ({bundles: boolean}), and the parser receives the
    // entire app config with the section nested under the identifier key.
    const merged = {
      identifier: 'purchase_options',
      experience: 'configuration',
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema:
          '{"type":"object","additionalProperties":false,"properties":{"bundles":{"type":"boolean","description":"Whether the app supports purchase options on bundle products"}}}',
      },
    }

    // When: The parser receives a full app config where "purchase_options" is a nested section
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema, 'strip')
    const result = parser({
      client_id: 'test-id',
      name: 'my-app',
      purchase_options: {bundles: true},
      webhooks: {api_version: '2024-01'},
    })

    // Then: The parser should scope to the section, validate {bundles: true} against the
    // schema, and return only the section contents — not an empty object.
    expect(result.state).toBe('ok')
    expect(result.data).toEqual({bundles: true})
  })

  test('returns empty object when config spec identifier is not present in the config', async () => {
    // Given: Same contract-based config spec, but the TOML doesn't include the section
    const merged = {
      identifier: 'purchase_options',
      experience: 'configuration',
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema:
          '{"type":"object","additionalProperties":false,"properties":{"bundles":{"type":"boolean","description":"Whether the app supports purchase options on bundle products"}}}',
      },
    }

    // When: The config does NOT contain "purchase_options"
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema, 'strip')
    const result = parser({
      client_id: 'test-id',
      name: 'my-app',
      webhooks: {api_version: '2024-01'},
    })

    // Then: No scoping happens; strip removes all non-matching keys, leaving {}
    expect(result.state).toBe('ok')
    expect(result.data).toEqual({})
  })

  test('validates section contents against the JSON schema when scoped', async () => {
    // Given: A config spec with a required field in the JSON schema
    const merged = {
      identifier: 'my_config',
      experience: 'configuration',
      parseConfigurationObject: mockParseConfigurationObject,
      validationSchema: {
        jsonSchema:
          '{"type":"object","additionalProperties":false,"properties":{"enabled":{"type":"boolean"}},"required":["enabled"]}',
      },
    }

    // When: The section exists but is missing the required field
    const parser = await unifiedConfigurationParserFactory(merged as any, merged.validationSchema, 'strip')
    const result = parser({
      client_id: 'test-id',
      my_config: {not_enabled: true},
    })

    // Then: Validation should fail because "enabled" is required
    expect(result.state).toBe('error')
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
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
})
