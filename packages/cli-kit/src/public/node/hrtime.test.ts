import {startHRTime, endHRTimeInMs} from './hrtime.js'
import {describe, test, expect, vi} from 'vitest'

describe('hrtime', () => {
  test('startHRTime returns the current high-resolution real time', () => {
    // Given
    const mockTime: [number, number] = [123, 456]
    vi.spyOn(process, 'hrtime').mockReturnValue(mockTime)

    // When
    const result = startHRTime()

    // Then
    expect(process.hrtime).toHaveBeenCalled()
    expect(result).toEqual(mockTime)
  })

  test('endHRTimeInMs returns the time in milliseconds with 2 decimal places', () => {
    // Given
    const startTime: [number, number] = [100, 0]
    const diffTime: [number, number] = [1, 500000]
    vi.spyOn(process, 'hrtime').mockReturnValue(diffTime)

    // When
    const result = endHRTimeInMs(startTime)

    // Then
    expect(process.hrtime).toHaveBeenCalledWith(startTime)
    // 1 second + 500,000 nanoseconds = 1000ms + 0.5ms = 1000.5ms
    expect(result).toBe('1000.50')
  })

  test('endHRTimeInMs handles sub-millisecond precision', () => {
    // Given
    const startTime: [number, number] = [100, 0]
    const diffTime: [number, number] = [0, 1234567]
    vi.spyOn(process, 'hrtime').mockReturnValue(diffTime)

    // When
    const result = endHRTimeInMs(startTime)

    // Then
    expect(process.hrtime).toHaveBeenCalledWith(startTime)
    // 0 seconds + 1,234,567 nanoseconds = 1.234567ms
    expect(result).toBe('1.23')
  })
})
