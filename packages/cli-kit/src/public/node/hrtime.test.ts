import {startHRTime, endHRTimeInMs, type StartTime} from './hrtime.js'
import {describe, expect, test, vi} from 'vitest'

describe('hrtime', () => {
  describe('startHRTime', () => {
    test('returns a tuple with two numbers', () => {
      const result = startHRTime()

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(typeof result[0]).toBe('number')
      expect(typeof result[1]).toBe('number')
    })

    test('returns values that represent current time', () => {
      const result = startHRTime()

      // First element should be seconds (positive integer)
      expect(result[0]).toBeGreaterThan(0)
      expect(Number.isInteger(result[0])).toBe(true)

      // Second element should be nanoseconds (0-999999999)
      expect(result[1]).toBeGreaterThanOrEqual(0)
      expect(result[1]).toBeLessThan(1000000000)
      expect(Number.isInteger(result[1])).toBe(true)
    })

    test('returns different values on subsequent calls', () => {
      const first = startHRTime()
      const second = startHRTime()

      // At least one of the values should be different
      expect(first[0] !== second[0] || first[1] !== second[1]).toBe(true)
    })

    test('calls process.hrtime internally', () => {
      const mockHrtime = vi.spyOn(process, 'hrtime')
      mockHrtime.mockReturnValue([123, 456789])

      const result = startHRTime()

      expect(mockHrtime).toHaveBeenCalledWith()
      expect(result).toEqual([123, 456789])

      mockHrtime.mockRestore()
    })
  })

  describe('endHRTimeInMs', () => {
    test('returns a string representing milliseconds', () => {
      const startTime: StartTime = [1000, 0]

      // Mock process.hrtime to return a predictable diff
      const mockHrtime = vi.spyOn(process, 'hrtime')
      // 1.5 seconds: 1 second + 500,000,000 nanoseconds
      mockHrtime.mockReturnValue([1, 500000000])

      const result = endHRTimeInMs(startTime)

      expect(typeof result).toBe('string')
      // 1.5 seconds = 1500.00ms (fixed calculation)
      expect(result).toBe('1500.00')

      mockHrtime.mockRestore()
    })

    test('formats result to 2 decimal places', () => {
      const startTime: StartTime = [100, 0]

      const mockHrtime = vi.spyOn(process, 'hrtime')
      // ~123.46ms
      mockHrtime.mockReturnValue([0, 123456789])

      const result = endHRTimeInMs(startTime)

      expect(result).toBe('123.46')

      mockHrtime.mockRestore()
    })

    test('handles very small time differences', () => {
      const startTime: StartTime = [0, 0]

      const mockHrtime = vi.spyOn(process, 'hrtime')
      // 1ms
      mockHrtime.mockReturnValue([0, 1000000])

      const result = endHRTimeInMs(startTime)

      expect(result).toBe('1.00')

      mockHrtime.mockRestore()
    })

    test('handles zero time difference', () => {
      const startTime: StartTime = [0, 0]

      const mockHrtime = vi.spyOn(process, 'hrtime')
      mockHrtime.mockReturnValue([0, 0])

      const result = endHRTimeInMs(startTime)

      expect(result).toBe('0.00')

      mockHrtime.mockRestore()
    })

    test('handles large time differences', () => {
      const startTime: StartTime = [0, 0]

      const mockHrtime = vi.spyOn(process, 'hrtime')
      // 60 seconds
      mockHrtime.mockReturnValue([60, 0])

      const result = endHRTimeInMs(startTime)

      expect(result).toBe('60000.00')

      mockHrtime.mockRestore()
    })

    test('correctly converts nanoseconds to milliseconds', () => {
      const startTime: StartTime = [0, 0]

      const mockHrtime = vi.spyOn(process, 'hrtime')
      // Test various nanosecond values
      // 0.5 seconds = 500ms
      mockHrtime.mockReturnValue([0, 500000000])

      const result = endHRTimeInMs(startTime)

      expect(result).toBe('500.00')

      mockHrtime.mockRestore()
    })

    test('handles fractional nanoseconds correctly', () => {
      const startTime: StartTime = [0, 0]

      const mockHrtime = vi.spyOn(process, 'hrtime')
      // ~1.23ms
      mockHrtime.mockReturnValue([0, 1234567])

      const result = endHRTimeInMs(startTime)

      expect(result).toBe('1.23')

      mockHrtime.mockRestore()
    })

    test('passes startTime parameter to process.hrtime', () => {
      const startTime: StartTime = [12345, 67890]

      const mockHrtime = vi.spyOn(process, 'hrtime')
      mockHrtime.mockReturnValue([1, 0])

      endHRTimeInMs(startTime)

      expect(mockHrtime).toHaveBeenCalledWith(startTime)

      mockHrtime.mockRestore()
    })
  })

  describe('integration test', () => {
    test('startHRTime and endHRTimeInMs work together', async () => {
      const start = startHRTime()

      // Wait a small amount of time
      await new Promise((resolve) => setTimeout(resolve, 10))

      const duration = endHRTimeInMs(start)
      const durationMs = parseFloat(duration)

      // Should be at least ~10ms, allowing for timing variations
      expect(durationMs).toBeGreaterThan(8)
      // Should be much less than 100ms in normal conditions
      expect(durationMs).toBeLessThan(100)
      // Should match the format "number.xx"
      expect(duration).toMatch(/^\d+\.\d{2}$/)
    })

    test('measures different durations correctly', async () => {
      const start1 = startHRTime()
      await new Promise((resolve) => setTimeout(resolve, 5))
      const duration1 = parseFloat(endHRTimeInMs(start1))

      const start2 = startHRTime()
      await new Promise((resolve) => setTimeout(resolve, 15))
      const duration2 = parseFloat(endHRTimeInMs(start2))

      // Second measurement should be longer
      expect(duration2).toBeGreaterThan(duration1)
    })
  })
})
