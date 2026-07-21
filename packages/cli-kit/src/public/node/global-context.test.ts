import {getCurrentCommandId, setCurrentCommandId, _resetGlobalContext} from './global-context.js'
import {describe, expect, test} from 'vitest'

describe('global-context', () => {
  test('getCurrentCommandId returns an empty string initially', () => {
    // Given
    _resetGlobalContext()

    // When
    const currentCommandId = getCurrentCommandId()

    // Then
    expect(currentCommandId).toBe('')
  })

  test('setCurrentCommandId updates the ID correctly', () => {
    // Given
    _resetGlobalContext()

    // When
    setCurrentCommandId('my-test-command')

    // Then
    expect(getCurrentCommandId()).toBe('my-test-command')
  })

  test('_resetGlobalContext resets the global context state', () => {
    // Given
    setCurrentCommandId('some-command-id')
    expect(getCurrentCommandId()).toBe('some-command-id')

    // When
    _resetGlobalContext()

    // Then
    expect(getCurrentCommandId()).toBe('')
  })
})
