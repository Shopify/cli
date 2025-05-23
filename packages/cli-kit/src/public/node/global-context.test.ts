import {getCurrentCommandId, setCurrentCommandId} from './global-context.js'
import {describe, expect, test, beforeEach} from 'vitest'

describe('global-context', () => {
  beforeEach(() => {
    // Reset the global context state before each test to ensure isolation
    setCurrentCommandId('')
  })

  describe('getCurrentCommandId', () => {
    test('returns empty string by default', () => {
      expect(getCurrentCommandId()).toBe('')
    })

    test('returns the previously set command id', () => {
      setCurrentCommandId('app:dev')
      expect(getCurrentCommandId()).toBe('app:dev')
    })

    test('returns the most recently set command id', () => {
      setCurrentCommandId('app:dev')
      setCurrentCommandId('app:build')
      expect(getCurrentCommandId()).toBe('app:build')
    })
  })

  describe('setCurrentCommandId', () => {
    test('sets the command id correctly', () => {
      setCurrentCommandId('theme:dev')
      expect(getCurrentCommandId()).toBe('theme:dev')
    })

    test('can set command id to empty string', () => {
      setCurrentCommandId('app:deploy')
      setCurrentCommandId('')
      expect(getCurrentCommandId()).toBe('')
    })

    test('can set command id with special characters', () => {
      const commandWithSpecialChars = 'app:generate:extension'
      setCurrentCommandId(commandWithSpecialChars)
      expect(getCurrentCommandId()).toBe(commandWithSpecialChars)
    })

    test('can set command id with spaces', () => {
      const commandWithSpaces = 'custom command with spaces'
      setCurrentCommandId(commandWithSpaces)
      expect(getCurrentCommandId()).toBe(commandWithSpaces)
    })

    test('overwrites previous command id', () => {
      setCurrentCommandId('app:info')
      setCurrentCommandId('theme:check')
      expect(getCurrentCommandId()).toBe('theme:check')
    })

    test('handles multiple successive calls', () => {
      setCurrentCommandId('first')
      setCurrentCommandId('second')
      setCurrentCommandId('third')
      expect(getCurrentCommandId()).toBe('third')
    })

    test('persists command id across multiple get calls', () => {
      setCurrentCommandId('persistent-command')
      expect(getCurrentCommandId()).toBe('persistent-command')
      expect(getCurrentCommandId()).toBe('persistent-command')
      expect(getCurrentCommandId()).toBe('persistent-command')
    })

    test('handles long command ids', () => {
      const longCommandId = 'a'.repeat(1000)
      setCurrentCommandId(longCommandId)
      expect(getCurrentCommandId()).toBe(longCommandId)
    })

    test('handles unicode characters', () => {
      const unicodeCommand = 'app:dev:🚀:测试'
      setCurrentCommandId(unicodeCommand)
      expect(getCurrentCommandId()).toBe(unicodeCommand)
    })
  })

  describe('state isolation', () => {
    test('modifications affect all subsequent calls in same context', () => {
      setCurrentCommandId('initial')
      expect(getCurrentCommandId()).toBe('initial')

      setCurrentCommandId('updated')
      expect(getCurrentCommandId()).toBe('updated')
    })

    test('can reset to initial state', () => {
      setCurrentCommandId('some-command')
      expect(getCurrentCommandId()).toBe('some-command')

      setCurrentCommandId('')
      expect(getCurrentCommandId()).toBe('')
    })
  })
})
