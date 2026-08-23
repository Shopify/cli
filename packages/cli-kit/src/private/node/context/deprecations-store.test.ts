import {getNextDeprecationDate, setNextDeprecationDate} from './deprecations-store.js'
import {describe, test, expect} from 'vitest'

describe('deprecations-store', () => {
  test('getNextDeprecationDate returns undefined by default', () => {
    expect(getNextDeprecationDate()).toBeUndefined()
  })

  test('setNextDeprecationDate does not update store when given empty dates list', () => {
    setNextDeprecationDate([])
    expect(getNextDeprecationDate()).toBeUndefined()
  })

  test('setNextDeprecationDate does not update store when dates are in the past', () => {
    const pastDate = new Date(Date.now() - 100000)
    setNextDeprecationDate([pastDate])
    expect(getNextDeprecationDate()).toBeUndefined()
  })

  test('setNextDeprecationDate sets earliest future deprecation date', () => {
    const futureDate1 = new Date(Date.now() + 100000)
    const futureDate2 = new Date(Date.now() + 200000)

    setNextDeprecationDate([futureDate2, futureDate1])

    expect(getNextDeprecationDate()).toEqual(futureDate1)
  })

  test('setNextDeprecationDate updates store if a newer date is earlier than existing nextDeprecationDate', () => {
    const initialFutureDate = new Date(Date.now() + 100000)
    setNextDeprecationDate([initialFutureDate])

    const earlierFutureDate = new Date(Date.now() + 50000)
    setNextDeprecationDate([earlierFutureDate])

    expect(getNextDeprecationDate()).toEqual(earlierFutureDate)
  })

  test('setNextDeprecationDate keeps existing date if new future dates are later', () => {
    const initialFutureDate = new Date(Date.now() + 50000)
    setNextDeprecationDate([initialFutureDate])

    const laterFutureDate = new Date(Date.now() + 300000)
    setNextDeprecationDate([laterFutureDate])

    expect(getNextDeprecationDate()).toEqual(initialFutureDate)
  })
})
