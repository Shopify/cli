import {AbortController} from './abort.js'
import {describe, expect, test} from 'vitest'

describe('AbortController', () => {
  test('correctly sets aborted state on the signal', () => {
    const controller = new AbortController()
    expect(controller.signal.aborted).toBe(false)

    controller.abort()
    expect(controller.signal.aborted).toBe(true)
  })

  test('correctly carries reason in the signal when aborted', () => {
    const controller = new AbortController()
    expect(controller.signal.reason).toBeUndefined()

    const reason = 'test-reason'
    controller.abort(reason)
    expect(controller.signal.reason).toBe(reason)
  })
})
