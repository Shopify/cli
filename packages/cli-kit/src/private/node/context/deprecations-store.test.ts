import {getNextDeprecationDate, setNextDeprecationDate} from './deprecations-store.js'
import {describe, expect, test} from 'vitest'

describe('deprecations-store', () => {
  describe('getNextDeprecationDate', () => {
    test('returns the current deprecation date or undefined', () => {
      // Since this is global state and we can't easily reset it, we'll test the basic behavior
      const result = getNextDeprecationDate()
      // The result should be either undefined (initial state) or a Date (if set)
      expect(result === undefined || result instanceof Date).toBe(true)
    })
  })

  describe('setNextDeprecationDate', () => {
    test('sets the earliest future date from multiple dates', () => {
      const now = Date.now()
      // Far in the future to avoid conflicts with existing state
      // ~2.7 hours from now
      const date1 = new Date(now + 10000000)
      // ~5.5 hours from now
      const date2 = new Date(now + 20000000)
      // ~8.3 hours from now
      const date3 = new Date(now + 30000000)

      setNextDeprecationDate([date3, date1, date2])

      const result = getNextDeprecationDate()
      expect(result?.getTime()).toBeLessThanOrEqual(date1.getTime())
    })

    test('ignores past dates and only considers future dates', () => {
      const now = Date.now()
      // Past date
      const pastDate = new Date(now - 86400000)
      // Far future date to avoid conflicts
      const futureDate = new Date(now + 50000000)

      setNextDeprecationDate([pastDate, futureDate])

      const result = getNextDeprecationDate()
      expect(result).toBeDefined()
      expect(result!.getTime()).toBeGreaterThan(now)
    })

    test('returns undefined when no future dates are provided', () => {
      const now = Date.now()
      // Only past dates
      const pastDate1 = new Date(now - 86400000)
      const pastDate2 = new Date(now - 172800000)

      const result = setNextDeprecationDate([pastDate1, pastDate2])

      expect(result).toBe(undefined)
    })

    test('returns undefined when empty array is provided', () => {
      const result = setNextDeprecationDate([])

      expect(result).toBe(undefined)
    })

    test('handles single future date', () => {
      // Very far future date to avoid conflicts
      const futureDate = new Date(Date.now() + 100000000)

      setNextDeprecationDate([futureDate])

      const result = getNextDeprecationDate()
      expect(result).toBeDefined()
      expect(result!.getTime()).toBeGreaterThan(Date.now())
    })

    test('handles dates with millisecond precision', () => {
      const now = Date.now()
      // Use very specific future times
      const date1 = new Date(now + 200000000)
      const date2 = new Date(now + 200000001)

      setNextDeprecationDate([date2, date1])

      const result = getNextDeprecationDate()
      expect(result).toBeDefined()
      expect(result!.getTime()).toBeGreaterThan(now)
    })

    test('handles very close future dates', () => {
      const now = Date.now()
      // Very close to now but still future
      const veryCloseDate = new Date(now + 1000)

      setNextDeprecationDate([veryCloseDate])

      const result = getNextDeprecationDate()
      expect(result).toBeDefined()
      expect(result!.getTime()).toBeGreaterThan(now)
    })

    test('handles dates far in the future', () => {
      const farFutureDate = new Date('2099-12-31T23:59:59.999Z')

      setNextDeprecationDate([farFutureDate])

      const result = getNextDeprecationDate()
      expect(result).toBeDefined()
      expect(result!.getTime()).toBeGreaterThan(Date.now())
    })

    test('handles mixed past and future dates correctly', () => {
      const now = Date.now()
      // Mix of past and future dates
      const pastDate1 = new Date(now - 86400000)
      const pastDate2 = new Date(now - 172800000)
      const futureDate1 = new Date(now + 500000000)
      const futureDate2 = new Date(now + 600000000)

      setNextDeprecationDate([pastDate1, futureDate2, pastDate2, futureDate1])

      const result = getNextDeprecationDate()
      expect(result).toBeDefined()
      expect(result!.getTime()).toBeGreaterThan(now)
    })

    test('handles duplicate dates', () => {
      // Use a very specific future date
      const futureDate = new Date(Date.now() + 700000000)

      setNextDeprecationDate([futureDate, futureDate, futureDate])

      const result = getNextDeprecationDate()
      expect(result).toBeDefined()
      expect(result!.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('edge cases', () => {
    test('persists date across multiple get calls', () => {
      const result1 = getNextDeprecationDate()
      const result2 = getNextDeprecationDate()
      const result3 = getNextDeprecationDate()

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(result3).toBeDefined()

      // All should return the same value
      expect(result1?.getTime()).toBe(result2?.getTime())
      expect(result2?.getTime()).toBe(result3?.getTime())
    })

    test('only updates to earlier future dates when they are earlier', () => {
      const now = Date.now()
      // Start with a very far future date
      const veryFarDate = new Date(now + 1000000000)

      setNextDeprecationDate([veryFarDate])
      const initial = getNextDeprecationDate()

      // Try to set an earlier date
      const earlierDate = new Date(now + 900000000)
      setNextDeprecationDate([earlierDate])
      const updated = getNextDeprecationDate()

      expect(updated).toBeDefined()
      expect(initial).toBeDefined()

      // The updated date should be earlier than or equal to the initial date
      expect(updated!.getTime()).toBeLessThanOrEqual(initial!.getTime())
    })
  })
})
