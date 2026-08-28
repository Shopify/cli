import {commands} from './index.js'
import DoctorScan from './commands/app/doctor/scan.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/app command registration', () => {
  test('registers app:doctor:scan', () => {
    expect(commands['app:doctor:scan']).toBe(DoctorScan)
  })
})
