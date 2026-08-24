import {startHRTime, endHRTimeInMs} from './hrtime.js'
import {describe, expect, test, vi} from 'vitest'

describe('startHRTime', () => {
  test('returns the correct start time array', () => {
    const mockHrtime: [number, number] = [12345, 67890]
    const spy = vi.spyOn(process, 'hrtime').mockReturnValue(mockHrtime)

    const result = startHRTime()

    expect(spy).toHaveBeenCalledOnce()
    expect(result).toEqual(mockHrtime)
  })
})

describe('endHRTimeInMs', () => {
  test('returns the elapsed time in milliseconds as a string with two decimal places', () => {
    const startTime: [number, number] = [1000, 2000]
    const mockElapsed: [number, number] = [2, 500000]
    const spy = vi.spyOn(process, 'hrtime').mockReturnValue(mockElapsed)

    const result = endHRTimeInMs(startTime)

    expect(spy).toHaveBeenCalledWith(startTime)
    expect(result).toBe('2000.50')
  })

  test('formats integer elapsed milliseconds correctly', () => {
    const startTime: [number, number] = [1000, 2000]
    const mockElapsed: [number, number] = [1, 0]
    vi.spyOn(process, 'hrtime').mockReturnValue(mockElapsed)

    const result = endHRTimeInMs(startTime)

    expect(result).toBe('1000.00')
  })
})
