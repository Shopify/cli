import {commands} from './index.js'
import DoctorInstructions from './commands/app/doctor/instructions.js'
import DoctorScan from './commands/app/doctor/scan.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/app command registration', () => {
  test('registers App Doctor commands', () => {
    expect(commands['app:doctor:instructions']).toBe(DoctorInstructions)
    expect(commands['app:doctor:scan']).toBe(DoctorScan)
  })
})
