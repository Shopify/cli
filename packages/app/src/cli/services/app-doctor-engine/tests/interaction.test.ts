import {getRegistry} from '../registry/index.js'
import {describe, expect, test} from 'vitest'

describe('React Doctor-style interaction surface', () => {
  test('exposes the authoritative registry for list and explain commands', () => {
    const registry = getRegistry()
    expect(registry.length).toBeGreaterThanOrEqual(31)
    expect(registry.some((entry) => entry.id === 'TOKEN_LEAKAGE')).toBe(false)
    expect(registry.find((entry) => entry.id === 'CREDENTIAL_LOG_LEAKAGE')?.title).toBe('Credential reaches a log sink')
  })
})
