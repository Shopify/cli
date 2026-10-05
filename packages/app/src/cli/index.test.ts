import {commands} from './index.js'
import SecurityCheck from './commands/app/security/check.js'
import SecurityClean from './commands/app/security/clean.js'
import SecurityInstructions from './commands/app/security/instructions.js'
import SecurityRecord from './commands/app/security/record.js'
import SecurityReview from './commands/app/security/review.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/app command registration', () => {
  test('registers app security commands', () => {
    expect(commands['app:security:check']).toBe(SecurityCheck)
    expect(commands['app:security:clean']).toBe(SecurityClean)
    expect(commands['app:security:instructions']).toBe(SecurityInstructions)
    expect(commands['app:security:record']).toBe(SecurityRecord)
    expect(commands['app:security:review']).toBe(SecurityReview)
  })
})
