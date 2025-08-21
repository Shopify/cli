import {recordTiming, recordError, recordRetry, recordEvent, compileData, reset} from './storage.js'
import {ErrorCategory} from './error-categorizer.js'
import {describe, test, expect, beforeEach} from 'vitest'

describe('analytics/storage', () => {
  beforeEach(() => {
    reset()
  })

  describe('recordTiming', () => {
    test('starts a timing when called first time', () => {
      // When
      recordTiming('test-event')

      // Then
      const data = compileData()
      expect(data.timings.length).toBe(0)
      expect(data.events.length).toBe(1)
      expect(data.events[0]?.name).toBe('timing:start:test-event')
    })

    test('completes a timing when called second time', () => {
      // Given
      recordTiming('test-event')
      const delay = 10
      const delayPromise = new Promise((resolve) => setTimeout(resolve, delay))

      // When
      return delayPromise.then(() => {
        recordTiming('test-event')

        // Then
        const data = compileData()
        expect(data.timings.length).toBe(1)

        const timing = data.timings[0]
        expect(timing?.event).toBe('test-event')
        expect(timing?.duration).toBeGreaterThanOrEqual(0)

        expect(data.events.length).toBe(2)
        expect(data.events[0]?.name).toBe('timing:start:test-event')
        expect(data.events[1]?.name).toBe('timing:end:test-event')
      })
    })

    test('handles multiple concurrent timings', () => {
      // When
      recordTiming('event-1')
      recordTiming('event-2')
      recordTiming('event-3')

      // Then
      const dataAfterStart = compileData()
      expect(dataAfterStart.events.length).toBe(3)
      expect(dataAfterStart.timings.length).toBe(0)

      // When
      recordTiming('event-2')
      recordTiming('event-1')

      // Then
      const dataAfterComplete = compileData()
      expect(dataAfterComplete.timings.length).toBe(2)
      expect(dataAfterComplete.events.length).toBe(5)
    })

    test('ignores completion of non-existent timing', () => {
      // Given
      recordTiming('existing-event')

      // When
      recordTiming('non-existent-event')

      // Then
      const data = compileData()
      expect(data.events.length).toBe(2)
      expect(data.timings.length).toBe(0)
    })
  })

  describe('recordError', () => {
    test('records an Error object', () => {
      // Given
      const error = new Error('Network request failed')
      const beforeTime = Date.now()

      // When
      recordError(error)

      // Then
      const data = compileData()
      expect(data.errors.length).toBe(1)
      const errorEntry = data.errors[0]
      expect(errorEntry?.category).toBe(ErrorCategory.Network)
      expect(errorEntry?.message).toBe('Network request failed')
      expect(errorEntry?.timestamp).toBeGreaterThanOrEqual(beforeTime)

      expect(data.events.length).toBe(1)
      expect(data.events[0]?.name).toBe('error:NETWORK:Network request failed')
    })

    test('records a string error', () => {
      // When
      recordError('Simple string error')

      // Then
      const data = compileData()
      expect(data.errors.length).toBe(1)
      const errorEntry = data.errors[0]
      expect(errorEntry?.category).toBe(ErrorCategory.Unknown)
      expect(errorEntry?.message).toBe('Simple string error')
    })

    test('records non-error objects', () => {
      // When
      recordError({code: 'ERR_001', details: 'Something went wrong'})

      // Then
      const data = compileData()
      expect(data.errors.length).toBe(1)
      const errorEntry = data.errors[0]
      expect(errorEntry?.category).toBe(ErrorCategory.Unknown)
      expect(errorEntry?.message).toBe('[object Object]')
    })

    test('truncates long error messages in events', () => {
      // Given
      const longMessage = 'A'.repeat(100)
      const error = new Error(longMessage)

      // When
      recordError(error)

      // Then
      const data = compileData()
      const event = data.events[0]
      expect(event?.name).toBe(`error:UNKNOWN:${'A'.repeat(50)}`)
    })

    test('records multiple errors', () => {
      // When
      recordError(new Error('First error'))
      recordError(new Error('Second error'))
      recordError(new Error('Third error'))

      // Then
      const data = compileData()
      expect(data.errors.length).toBe(3)
      expect(data.errors[0]?.message).toBe('First error')
      expect(data.errors[1]?.message).toBe('Second error')
      expect(data.errors[2]?.message).toBe('Third error')
    })
  })

  describe('recordRetry', () => {
    test('records first retry attempt', () => {
      // Given
      const url = 'https://api.example.com/themes'
      const operation = 'upload'
      const beforeTime = Date.now()

      // When
      recordRetry(url, operation)

      // Then
      const data = compileData()
      expect(data.retries.length).toBe(1)
      const retry = data.retries[0]
      expect(retry?.url).toBe(url)
      expect(retry?.operation).toBe(operation)
      expect(retry?.attempts).toBe(1)
      expect(retry?.timestamp).toBeGreaterThanOrEqual(beforeTime)

      expect(data.events.length).toBe(1)
      expect(data.events[0]?.name).toBe('retry:upload:attempt:1')
    })

    test('increments attempt count for same url and operation', () => {
      // Given
      const url = 'https://api.example.com/themes'
      const operation = 'upload'

      // When
      recordRetry(url, operation)
      recordRetry(url, operation)
      recordRetry(url, operation)

      // Then
      const data = compileData()
      expect(data.retries.length).toBe(3)
      expect(data.retries[0]?.attempts).toBe(1)
      expect(data.retries[1]?.attempts).toBe(2)
      expect(data.retries[2]?.attempts).toBe(3)

      expect(data.events[0]?.name).toBe('retry:upload:attempt:1')
      expect(data.events[1]?.name).toBe('retry:upload:attempt:2')
      expect(data.events[2]?.name).toBe('retry:upload:attempt:3')
    })

    test('tracks retries independently for different URLs', () => {
      // When
      recordRetry('https://api1.example.com', 'upload')
      recordRetry('https://api2.example.com', 'upload')
      recordRetry('https://api1.example.com', 'upload')

      // Then
      const data = compileData()
      expect(data.retries.length).toBe(3)
      expect(data.retries[0]?.attempts).toBe(1)
      expect(data.retries[1]?.attempts).toBe(1)
      expect(data.retries[2]?.attempts).toBe(2)
    })

    test('tracks retries independently for different operations', () => {
      // Given
      const url = 'https://api.example.com'

      // When
      recordRetry(url, 'upload')
      recordRetry(url, 'download')
      recordRetry(url, 'upload')

      // Then
      const data = compileData()
      expect(data.retries.length).toBe(3)
      expect(data.retries[0]?.attempts).toBe(1)
      expect(data.retries[1]?.attempts).toBe(1)
      expect(data.retries[2]?.attempts).toBe(2)
    })
  })

  describe('recordEvent', () => {
    test('records a custom event', () => {
      // Given
      const beforeTime = Date.now()

      // When
      recordEvent('custom-event-name')

      // Then
      const data = compileData()
      expect(data.events.length).toBe(1)
      const event = data.events[0]
      expect(event?.name).toBe('custom-event-name')
      expect(event?.timestamp).toBeGreaterThanOrEqual(beforeTime)
    })

    test('records multiple events in order', () => {
      // When
      recordEvent('event-1')
      recordEvent('event-2')
      recordEvent('event-3')

      // Then
      const data = compileData()
      expect(data.events.length).toBe(3)
      expect(data.events[0]?.name).toBe('event-1')
      expect(data.events[1]?.name).toBe('event-2')
      expect(data.events[2]?.name).toBe('event-3')
    })
  })

  describe('compileData', () => {
    test('returns all collected data', () => {
      // Given
      recordTiming('test-timing')
      recordTiming('test-timing')
      recordError(new Error('Test error'))
      recordRetry('https://example.com', 'test-op')
      recordEvent('test-event')

      // When
      const data = compileData()

      // Then
      expect(data.timings.length).toBe(1)
      expect(data.errors.length).toBe(1)
      expect(data.retries.length).toBe(1)
      expect(data.events.length).toBeGreaterThan(1)

      const data2 = compileData()
      expect(data).not.toBe(data2)
      expect(data.timings).not.toBe(data2.timings)
      expect(data.errors).not.toBe(data2.errors)
      expect(data.retries).not.toBe(data2.retries)
      expect(data.events).not.toBe(data2.events)
    })

    test('returns empty arrays when no data collected', () => {
      // When
      const data = compileData()

      // Then
      expect(data.timings).toEqual([])
      expect(data.errors).toEqual([])
      expect(data.retries).toEqual([])
      expect(data.events).toEqual([])
    })
  })

  describe('reset', () => {
    test('clears all stored data', () => {
      // Given
      recordTiming('test-timing')
      recordError(new Error('Test error'))
      recordRetry('https://example.com', 'test-op')
      recordEvent('test-event')

      // When
      reset()

      // Then
      const data = compileData()
      expect(data.timings.length).toBe(0)
      expect(data.errors.length).toBe(0)
      expect(data.retries.length).toBe(0)
      expect(data.events.length).toBe(0)
    })

    test('allows recording new data after reset', () => {
      // Given
      recordEvent('before-reset')
      reset()

      // When
      recordEvent('after-reset')

      // Then
      const data = compileData()
      expect(data.events.length).toBe(1)
      expect(data.events[0]?.name).toBe('after-reset')
    })
  })

  describe('integration tests', () => {
    test('handles complete workflow with all data types', () => {
      // Given
      recordTiming('operation-1')
      recordTiming('operation-2')
      recordError(new Error('Network timeout'))
      recordError('Validation failed')
      recordRetry('https://api.example.com/upload', 'upload')
      recordRetry('https://api.example.com/upload', 'upload')

      // When
      recordTiming('operation-1')
      recordTiming('operation-2')
      recordEvent('workflow-complete')

      // Then
      const data = compileData()
      expect(data.timings.length).toBe(2)
      expect(data.errors.length).toBe(2)
      expect(data.retries.length).toBe(2)
      expect(data.events.length).toBeGreaterThan(5)
    })
  })
})
