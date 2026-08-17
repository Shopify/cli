import {getCurrentCommandId, setCurrentCommandId} from './global-context.js'
import {afterEach, describe, expect, test} from 'vitest'

describe('global-context', () => {
  afterEach(() => {
    setCurrentCommandId('')
  })

  test('returns empty string as default command ID', () => {
    expect(getCurrentCommandId()).toBe('')
  })

  test('sets and gets current command ID', () => {
    setCurrentCommandId('test-command-123')
    expect(getCurrentCommandId()).toBe('test-command-123')
  })
})
