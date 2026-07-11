import {getCurrentCommandId, setCurrentCommandId, _resetGlobalContext} from './global-context.js'
import {describe, expect, test, beforeEach} from 'vitest'

describe('global-context', () => {
  beforeEach(() => {
    _resetGlobalContext()
  })

  test('getCurrentCommandId returns an empty string by default', () => {
    // When
    const got = getCurrentCommandId()

    // Then
    expect(got).toBe('')
  })

  test('setCurrentCommandId updates the current command ID', () => {
    // Given
    const commandId = 'my-command'

    // When
    setCurrentCommandId(commandId)
    const got = getCurrentCommandId()

    // Then
    expect(got).toBe(commandId)
  })
})
