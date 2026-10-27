import {waitForAll} from './batching.js'
import {expect, test, vi} from 'vitest'

test('waits for pending work before reporting a concurrent failure', async () => {
  const error = new Error('One operation failed')
  const {promise: pending, resolve: finish} = Promise.withResolvers<void>()
  const failed = vi.fn()
  const work = waitForAll([Promise.reject(error), pending]).catch(failed)

  await new Promise((resolve) => setImmediate(resolve))
  expect(failed).not.toHaveBeenCalled()
  finish()
  await work
  expect(failed).toHaveBeenCalledWith(error)
})
