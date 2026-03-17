import {expect} from 'vitest'
import {z} from 'zod'

process.env.SHOPIFY_UNIT_TEST = '1'
process.removeAllListeners('warning')

// This is a workaround for the issue with zod not supporting vitest's custom equality tester
// https://github.com/vitest-dev/vitest/issues/7315#issuecomment-2606572923
expect.addEqualityTesters([
  function (a, b) {
    const aOk = a instanceof z.ZodError
    const bOk = b instanceof z.ZodError
    if (aOk && bOk) {
      return this.equals(a.message, b.message) && this.equals(a.issues, b.issues)
    }
    return aOk !== bOk ? false : undefined
  },
])
