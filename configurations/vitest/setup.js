import {expect} from 'vitest'

process.env.SHOPIFY_UNIT_TEST = '1'
process.removeAllListeners('warning')

// This is a workaround for the issue with zod not supporting vitest's custom equality tester
// https://github.com/vitest-dev/vitest/issues/7315#issuecomment-2606572923
expect.addEqualityTesters([
  function (a, b) {
    // Lazy check for ZodError to avoid importing zod eagerly
    const aOk = a?.constructor?.name === 'ZodError' && 'issues' in a
    const bOk = b?.constructor?.name === 'ZodError' && 'issues' in b
    if (aOk && bOk) {
      return this.equals(a.message, b.message) && this.equals(a.issues, b.issues)
    }
    return aOk !== bOk ? false : undefined
  },
])
