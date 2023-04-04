import {getDeprecation, setDeprecationDates, setDeprecatingSoon, resetDeprecation} from './deprecations-store.js'
import {expect, test, describe, beforeEach} from 'vitest'

beforeEach(() => {
  resetDeprecation()
})

describe('getDeprecation', () => {
  test('returns undefined when no deprecations are set', async () => {
    expect(getDeprecation()).toEqual(undefined)
  })
})

describe('setDeprecatingSoon', () => {
  test('sets deprecatingSoon as nextDeprecation', async () => {
    setDeprecatingSoon()
    const deprecation = getDeprecation()
    expect(deprecation).toEqual({deprecatingSoon: true})
  })
})

describe('setDeprecationDates', () => {
  test('sets the earliest future date as nextDeprecation', async () => {
    const now = new Date()
    const pastDate = new Date(now.getTime() - 1000 * 60)
    const futureDate = new Date(now.getTime() + 1000 * 60)
    const farFutureDate = new Date(now.getTime() + 1000 * 60 * 60)

    setDeprecationDates([farFutureDate, pastDate, futureDate])
    const nextDeprecation = getDeprecation()

    if (nextDeprecation) {
      expect(nextDeprecation).toEqual({date: futureDate})
    }
  })

  test('does not override deprecatingSoon', async () => {
    setDeprecatingSoon()

    const futureDate = new Date(Date.now() + 1000 * 60)
    setDeprecationDates([futureDate])

    const deprecation = getDeprecation()
    expect(deprecation).toEqual({deprecatingSoon: true})
  })

  test('ignores past dates', async () => {
    const pastDate = new Date(Date.now() - 1000 * 60)

    setDeprecationDates([pastDate])
    const deprecation = getDeprecation()
    expect(deprecation).toEqual(undefined)
  })
})
