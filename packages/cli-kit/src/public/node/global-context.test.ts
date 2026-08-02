import {getCurrentCommandId, setCurrentCommandId} from './global-context.js'
import {describe, expect, test, beforeEach, afterEach} from 'vitest'

describe('global-context', () => {
  let originalCommandId: string

  beforeEach(() => {
    originalCommandId = getCurrentCommandId()
  })

  afterEach(() => {
    setCurrentCommandId(originalCommandId)
  })

  test('returns the default command id as an empty string', () => {
    // We can't guarantee that other code hasn't modified it before this test suite runs,
    // but we can assert the get and set behavior.
    setCurrentCommandId('')
    expect(getCurrentCommandId()).toBe('')
  })

  test('correctly sets and gets the command id', () => {
    setCurrentCommandId('test-command-id-123')
    expect(getCurrentCommandId()).toBe('test-command-id-123')
  })

  test('allows changing the command id multiple times', () => {
    setCurrentCommandId('first-command')
    expect(getCurrentCommandId()).toBe('first-command')

    setCurrentCommandId('second-command')
    expect(getCurrentCommandId()).toBe('second-command')
  })
})
