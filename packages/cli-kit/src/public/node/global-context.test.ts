import {getCurrentCommandId, setCurrentCommandId} from './global-context.js'
import {describe, expect, test} from 'vitest'

describe('global-context', () => {
  test('returns empty string by default for command ID', () => {
    // When/Then
    expect(getCurrentCommandId()).toBe('')
  })

  test('sets and gets the current command ID correctly', () => {
    // Given
    const testCommandId = 'my-test-command'

    // When
    setCurrentCommandId(testCommandId)

    // Then
    expect(getCurrentCommandId()).toBe(testCommandId)
  })
})
