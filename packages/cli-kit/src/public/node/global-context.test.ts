import {getCurrentCommandId, setCurrentCommandId} from './global-context.js'
import {afterEach, describe, expect, test} from 'vitest'

describe('global-context', () => {
  afterEach(() => {
    setCurrentCommandId('')
  })

  test('getCurrentCommandId returns empty string by default', () => {
    // When
    const got = getCurrentCommandId()

    // Then
    expect(got).toBe('')
  })

  test('setCurrentCommandId updates current command ID', () => {
    // Given
    const commandId = 'app:dev'

    // When
    setCurrentCommandId(commandId)

    // Then
    expect(getCurrentCommandId()).toBe('app:dev')
  })
})
