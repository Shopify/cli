import {parseJSON} from './json.js'
import {AbortError} from '../node/error.js'
import {describe, expect, test} from 'vitest'

describe('parseJSON', () => {
  test('parses valid JSON with nested objects', () => {
    // Given
    const jsonString = '{"user": {"name": "Alice", "age": 30}}'

    // When
    const result = parseJSON(jsonString)

    // Then
    expect(result).toEqual({user: {name: 'Alice', age: 30}})
  })

  test('throws AbortError for malformed JSON without context', () => {
    // Given
    const malformedJSON = '{"name": "test", invalid}'

    // When/Then
    expect(() => parseJSON(malformedJSON)).toThrow(AbortError)
    expect(() => parseJSON(malformedJSON)).toThrow(/Failed to parse JSON/)
  })

  test('throws AbortError for malformed JSON with context', () => {
    // Given
    const malformedJSON = '{"name": "test", invalid}'
    const context = '/path/to/config.json'

    // When/Then
    expect(() => parseJSON(malformedJSON, context)).toThrow(AbortError)
    expect(() => parseJSON(malformedJSON, context)).toThrow(/Failed to parse JSON from \/path\/to\/config\.json/)
  })

  test('throws AbortError with original error message', () => {
    // Given
    const malformedJSON = '{"trailing comma":,}'

    // When/Then
    expect(() => parseJSON(malformedJSON)).toThrow(/Unexpected token/)
  })

  test('handles null value', () => {
    // Given
    const jsonString = 'null'

    // When
    const result = parseJSON(jsonString)

    // Then
    expect(result).toBeNull()
  })
})
