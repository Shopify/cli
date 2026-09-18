import {commands} from './index.js'
import SecurityCheck from './commands/app/security/check.js'
import SecurityInstructions from './commands/app/security/instructions.js'
import SecuritySubmit from './commands/app/security/submit.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/app command registration', () => {
  test('registers App Security commands', () => {
    expect(commands['app:security:check']).toBe(SecurityCheck)
    expect(commands['app:security:instructions']).toBe(SecurityInstructions)
    expect(commands['app:security:submit']).toBe(SecuritySubmit)
    expect(commands['app:doctor']).toBeUndefined()
    expect(commands['app:doctor:scan']).toBeUndefined()
  })
})
