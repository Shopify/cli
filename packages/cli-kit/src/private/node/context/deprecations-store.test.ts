import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

describe('deprecations-store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('getNextDeprecationDate initially returns undefined', async () => {
    const {getNextDeprecationDate} = await import('./deprecations-store.js')
    vi.setSystemTime(new Date(2025, 0, 1))

    expect(getNextDeprecationDate()).toBeUndefined()
  })

  test('setNextDeprecationDate with empty array does not set deprecation date', async () => {
    const {getNextDeprecationDate, setNextDeprecationDate} = await import('./deprecations-store.js')
    vi.setSystemTime(new Date(2025, 0, 1))

    setNextDeprecationDate([])
    expect(getNextDeprecationDate()).toBeUndefined()
  })

  test('setNextDeprecationDate with past dates does not set deprecation date', async () => {
    const {getNextDeprecationDate, setNextDeprecationDate} = await import('./deprecations-store.js')
    vi.setSystemTime(new Date(2025, 0, 15))

    const pastDate = new Date(2025, 0, 1)
    setNextDeprecationDate([pastDate])

    expect(getNextDeprecationDate()).toBeUndefined()
  })

  test('setNextDeprecationDate with a future date sets the deprecation date', async () => {
    const {getNextDeprecationDate, setNextDeprecationDate} = await import('./deprecations-store.js')
    vi.setSystemTime(new Date(2025, 0, 1))

    const futureDate = new Date(2025, 0, 10)
    setNextDeprecationDate([futureDate])

    expect(getNextDeprecationDate()).toEqual(futureDate)
  })

  test('setNextDeprecationDate updates if a new future date is earlier than stored date', async () => {
    const {getNextDeprecationDate, setNextDeprecationDate} = await import('./deprecations-store.js')
    vi.setSystemTime(new Date(2025, 0, 1))

    const laterFutureDate = new Date(2025, 0, 20)
    const earlierFutureDate = new Date(2025, 0, 10)

    setNextDeprecationDate([laterFutureDate])
    expect(getNextDeprecationDate()).toEqual(laterFutureDate)

    setNextDeprecationDate([earlierFutureDate])
    expect(getNextDeprecationDate()).toEqual(earlierFutureDate)
  })

  test('setNextDeprecationDate preserves existing date if new future date is later', async () => {
    const {getNextDeprecationDate, setNextDeprecationDate} = await import('./deprecations-store.js')
    vi.setSystemTime(new Date(2025, 0, 1))

    const earlierFutureDate = new Date(2025, 0, 10)
    const laterFutureDate = new Date(2025, 0, 20)

    setNextDeprecationDate([earlierFutureDate])
    expect(getNextDeprecationDate()).toEqual(earlierFutureDate)

    setNextDeprecationDate([laterFutureDate])
    expect(getNextDeprecationDate()).toEqual(earlierFutureDate)
  })

  test('setNextDeprecationDate selects earliest date when given multiple unsorted future dates', async () => {
    const {getNextDeprecationDate, setNextDeprecationDate} = await import('./deprecations-store.js')
    vi.setSystemTime(new Date(2025, 0, 1))

    const futureDate1 = new Date(2025, 0, 30)
    const futureDate2 = new Date(2025, 0, 10)
    const futureDate3 = new Date(2025, 0, 20)

    setNextDeprecationDate([futureDate1, futureDate2, futureDate3])

    expect(getNextDeprecationDate()).toEqual(futureDate2)
  })
})
