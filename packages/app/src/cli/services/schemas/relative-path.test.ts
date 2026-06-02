import {posixRelativeSchemaPath} from './relative-path.js'
import {describe, expect, test} from 'vitest'

describe('posixRelativeSchemaPath', () => {
  test('returns a path with `./` prefix when the schema is in a sibling directory', () => {
    // Given
    const toml = '/app/shopify.app.toml'
    const schema = '/app/.shopify/schemas/app.schema.json'

    // When
    const result = posixRelativeSchemaPath(toml, schema)

    // Then
    expect(result).toBe('./.shopify/schemas/app.schema.json')
  })

  test('uses `..` traversal when the TOML is in a deeper directory', () => {
    // Given
    const toml = '/app/extensions/my-ext/shopify.extension.toml'
    const schema = '/app/.shopify/schemas/extensions/ui_extension.schema.json'

    // When
    const result = posixRelativeSchemaPath(toml, schema)

    // Then
    expect(result).toBe('../../.shopify/schemas/extensions/ui_extension.schema.json')
  })

  test('leaves an explicit `./` prefix in place rather than adding a redundant one', () => {
    // Given
    const toml = '/app/shopify.app.toml'
    const schema = '/app/schema.json'

    // When
    const result = posixRelativeSchemaPath(toml, schema)

    // Then
    expect(result).toBe('./schema.json')
  })

  test('always emits POSIX separators regardless of input style', () => {
    // Given
    const toml = '/app/extensions/my-ext/shopify.extension.toml'
    const schema = '/app/.shopify/schemas/extensions/checkout_ui_extension.schema.json'

    // When
    const result = posixRelativeSchemaPath(toml, schema)

    // Then
    expect(result).not.toContain('\\')
  })
})
