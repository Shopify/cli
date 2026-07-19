import {generateRandomId} from './randomId'
import {describe, test, expect, vi, afterEach} from 'vitest'

describe('generateRandomId', () => {
  afterEach(() => {
    // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
    vi.restoreAllMocks()
  })

  test('uses globalThis.crypto.randomUUID when available', () => {
    const mockUUID = '12345678-1234-1234-1234-123456789012'
    const randomUUIDSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(mockUUID)

    const id = generateRandomId()

    expect(id).toBe(mockUUID)
    expect(randomUUIDSpy).toHaveBeenCalledTimes(1)
  })

  test('falls back to Math.random() when globalThis.crypto.randomUUID is not available', () => {
    const originalCrypto = globalThis.crypto
    const originalRandomUUID = globalThis.crypto?.randomUUID

    if (globalThis.crypto) {
      ;(globalThis.crypto as any).randomUUID = undefined
    }

    const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

    const id = generateRandomId()

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(mathRandomSpy).toHaveBeenCalled()

    if (originalCrypto) {
      ;(originalCrypto as any).randomUUID = originalRandomUUID
    }
  })
})
