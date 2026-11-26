import {expect} from 'vitest'
import {z} from 'zod/v3'

process.env.SHOPIFY_UNIT_TEST = '1'
// Tests that expect no client secret must not pick one up from the shell running them.
delete process.env.SHOPIFY_CLI_APP_CLIENT_SECRET
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
