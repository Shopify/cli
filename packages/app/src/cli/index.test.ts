import {commands} from './index.js'
import DoctorInstructions from './commands/app/doctor/instructions.js'
import Doctor from './commands/app/doctor.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/app command registration', () => {
  test('registers App Doctor commands', () => {
    expect(commands['app:doctor:instructions']).toBe(DoctorInstructions)
    expect(commands['app:doctor']).toBe(Doctor)
    expect(commands['app:doctor:scan']).toBeUndefined()
  })
})
