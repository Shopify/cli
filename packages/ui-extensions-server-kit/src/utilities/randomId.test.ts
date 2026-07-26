import {generateRandomId} from './randomId'
import {describe, test, expect, vi, afterEach} from 'vitest'

describe('generateRandomId', () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    // Restore global crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    })
    // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
    vi.restoreAllMocks()
  })

  test('uses globalThis.crypto.randomUUID when available', () => {
    const mockUUID = '12345678-1234-1234-1234-123456789abc'
    const mockRandomUUID = vi.fn().mockReturnValue(mockUUID)

    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: mockRandomUUID,
      },
      writable: true,
      configurable: true,
    })

    const id = generateRandomId()
    expect(id).toBe(mockUUID)
    expect(mockRandomUUID).toHaveBeenCalledTimes(1)
  })

  test('falls back to Math.random when crypto is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.123456)

    const id = generateRandomId()
    expect(id).toBeDefined()
    expect(typeof id).toBe('string')
    expect(mockRandom).toHaveBeenCalled()
  })

  test('falls back to Math.random when randomUUID is not a function', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      writable: true,
      configurable: true,
    })

    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.123456)

    const id = generateRandomId()
    expect(id).toBeDefined()
    expect(typeof id).toBe('string')
    expect(mockRandom).toHaveBeenCalled()
  })
})
