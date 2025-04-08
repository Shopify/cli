import {isPolarisUnifiedEnabled} from './is-polaris-unified-enabled.js'
import {describe, test, expect, vi} from 'vitest'

describe('isPolarisUnifiedEnabled', () => {
  test('returns true when POLARIS_UNIFIED is set to truthy value', () => {
    vi.stubEnv('POLARIS_UNIFIED', 'true')
    expect(isPolarisUnifiedEnabled()).toBe(true)
  })

  test('returns false when POLARIS_UNIFIED is set to falsy value', () => {
    vi.stubEnv('POLARIS_UNIFIED', 'false')
    expect(isPolarisUnifiedEnabled()).toBe(false)
  })

  test('returns false when POLARIS_UNIFIED is not set', () => {
    expect(isPolarisUnifiedEnabled()).toBe(false)
  })
})
