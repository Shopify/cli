import {getCurrentCommandId, setCurrentCommandId, _resetGlobalContext} from './global-context.js'
import {describe, expect, test, beforeEach} from 'vitest'

describe('global-context', () => {
  beforeEach(() => {
    _resetGlobalContext()
  })

  test('returns an empty string as default command ID', () => {
    expect(getCurrentCommandId()).toBe('')
  })

  test('sets and gets the current command ID', () => {
    setCurrentCommandId('test-command-id')
    expect(getCurrentCommandId()).toBe('test-command-id')
  })

  test('correctly resets the global context', () => {
    setCurrentCommandId('temp-id')
    expect(getCurrentCommandId()).toBe('temp-id')

    _resetGlobalContext()
    expect(getCurrentCommandId()).toBe('')
  })
})
