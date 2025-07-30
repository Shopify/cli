import {recordTiming, recordError, recordRetry, recordEvent} from './analytics.js'
import * as store from './analytics/storage.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('./analytics/storage.js', () => ({
  recordTiming: vi.fn(),
  recordError: vi.fn(),
  recordRetry: vi.fn(),
  recordEvent: vi.fn(),
}))

describe('analytics/index', () => {
  describe('recordTiming', () => {
    test('delegates to store.recordTiming', () => {
      // Given
      const eventName = 'test-timing-event'

      // When
      recordTiming(eventName)

      // Then
      expect(store.recordTiming).toHaveBeenCalledOnce()
      expect(store.recordTiming).toHaveBeenCalledWith(eventName)
    })

    test('passes through different event names correctly', () => {
      // When
      recordTiming('event-1')
      recordTiming('event-2')
      recordTiming('another-event')

      // Then
      expect(store.recordTiming).toHaveBeenCalledTimes(3)
      expect(store.recordTiming).toHaveBeenNthCalledWith(1, 'event-1')
      expect(store.recordTiming).toHaveBeenNthCalledWith(2, 'event-2')
      expect(store.recordTiming).toHaveBeenNthCalledWith(3, 'another-event')
    })
  })

  describe('recordError', () => {
    test('delegates to store.recordError with Error object', () => {
      // Given
      const error = new Error('Test error message')

      // When
      recordError(error)

      // Then
      expect(store.recordError).toHaveBeenCalledOnce()
      expect(store.recordError).toHaveBeenCalledWith(error)
    })

    test('delegates to store.recordError with string', () => {
      // Given
      const errorString = 'String error message'

      // When
      recordError(errorString)

      // Then
      expect(store.recordError).toHaveBeenCalledOnce()
      expect(store.recordError).toHaveBeenCalledWith(errorString)
    })

    test('delegates to store.recordError with arbitrary objects', () => {
      // Given
      const errorObj = {code: 'ERR_001', message: 'Custom error'}

      // When
      recordError(errorObj)

      // Then
      expect(store.recordError).toHaveBeenCalledOnce()
      expect(store.recordError).toHaveBeenCalledWith(errorObj)
    })

    test('passes through null and undefined', () => {
      // When
      recordError(null)
      recordError(undefined)

      // Then
      expect(store.recordError).toHaveBeenCalledTimes(2)
      expect(store.recordError).toHaveBeenNthCalledWith(1, null)
      expect(store.recordError).toHaveBeenNthCalledWith(2, undefined)
    })
  })

  describe('recordRetry', () => {
    test('delegates to store.recordRetry', () => {
      // Given
      const url = 'https://api.example.com/themes'
      const operation = 'upload'

      // When
      recordRetry(url, operation)

      // Then
      expect(store.recordRetry).toHaveBeenCalledOnce()
      expect(store.recordRetry).toHaveBeenCalledWith(url, operation)
    })

    test('passes through different URLs and operations', () => {
      // When
      recordRetry('https://api1.com', 'upload')
      recordRetry('https://api2.com', 'download')
      recordRetry('https://api3.com', 'sync')

      // Then
      expect(store.recordRetry).toHaveBeenCalledTimes(3)
      expect(store.recordRetry).toHaveBeenNthCalledWith(1, 'https://api1.com', 'upload')
      expect(store.recordRetry).toHaveBeenNthCalledWith(2, 'https://api2.com', 'download')
      expect(store.recordRetry).toHaveBeenNthCalledWith(3, 'https://api3.com', 'sync')
    })

    test('handles empty strings', () => {
      // When
      recordRetry('', '')

      // Then
      expect(store.recordRetry).toHaveBeenCalledOnce()
      expect(store.recordRetry).toHaveBeenCalledWith('', '')
    })
  })

  describe('recordEvent', () => {
    test('delegates to store.recordEvent', () => {
      // Given
      const eventName = 'custom-event'

      // When
      recordEvent(eventName)

      // Then
      expect(store.recordEvent).toHaveBeenCalledOnce()
      expect(store.recordEvent).toHaveBeenCalledWith(eventName)
    })

    test('passes through various event names', () => {
      // When
      recordEvent('theme-dev-started')
      recordEvent('file-watcher-connected')
      recordEvent('user-action:save')
      recordEvent('system-event:reload')

      // Then
      expect(store.recordEvent).toHaveBeenCalledTimes(4)
      expect(store.recordEvent).toHaveBeenNthCalledWith(1, 'theme-dev-started')
      expect(store.recordEvent).toHaveBeenNthCalledWith(2, 'file-watcher-connected')
      expect(store.recordEvent).toHaveBeenNthCalledWith(3, 'user-action:save')
      expect(store.recordEvent).toHaveBeenNthCalledWith(4, 'system-event:reload')
    })

    test('handles special characters in event names', () => {
      // When
      recordEvent('event:with:colons')
      recordEvent('event-with-dashes')
      recordEvent('event_with_underscores')
      recordEvent('event.with.dots')

      // Then
      expect(store.recordEvent).toHaveBeenCalledTimes(4)
    })
  })

  describe('public API integration', () => {
    test('all functions are properly exported and callable', () => {
      // When
      // Then
      expect(typeof recordTiming).toBe('function')
      expect(typeof recordError).toBe('function')
      expect(typeof recordRetry).toBe('function')
      expect(typeof recordEvent).toBe('function')
    })

    test('functions can be called in sequence', () => {
      // When
      recordEvent('operation-start')
      recordTiming('file-upload')
      recordRetry('https://api.example.com', 'upload')
      recordError(new Error('Upload failed'))
      recordTiming('file-upload')
      recordEvent('operation-end')

      // Then
      expect(store.recordEvent).toHaveBeenCalledTimes(2)
      expect(store.recordTiming).toHaveBeenCalledTimes(2)
      expect(store.recordRetry).toHaveBeenCalledTimes(1)
      expect(store.recordError).toHaveBeenCalledTimes(1)
    })
  })
})
