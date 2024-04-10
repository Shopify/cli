import {getAvailableTCPPort} from './tcp.js'
import * as system from './system.js'
import {AbortError} from './error.js'
import * as port from 'get-port-please'
import {describe, expect, test, vi} from 'vitest'

vi.mock('get-port-please')

const errorMessage = 'Unable to generate random port'

describe('getAvailableTCPPort', () => {
  test('returns random port if the number retries is not exceeded', async () => {
    // Given
    vi.mocked(port.getRandomPort).mockRejectedValueOnce(new Error(errorMessage))
    vi.mocked(port.getRandomPort).mockResolvedValue(5)
    const debugError = vi.spyOn(system, 'sleep')

    // When
    const got = await getAvailableTCPPort(undefined, {waitTimeInSeconds: 0})

    // Then
    expect(got).toBe(5)
    expect(debugError).toHaveBeenCalledOnce()
  })

  test('throws an abort exception with same error message received from third party getRandomPort if the number retries is exceeded', async () => {
    // Given
    const maxTries = 5
    for (let i = 0; i < maxTries; i++) {
      vi.mocked(port.getRandomPort).mockRejectedValueOnce(new Error(errorMessage))
    }

    // When/Then
    await expect(() => getAvailableTCPPort()).rejects.toThrowError(new AbortError(errorMessage))
  })

  test('returns the provided port when it is available', async () => {
    // Given
    vi.mocked(port.checkPort).mockResolvedValue(666)

    // When
    const got = await getAvailableTCPPort(666)

    // Then
    expect(got).toBe(666)
  })

  test('returns a random port when the provided one is not available', async () => {
    // Given
    vi.mocked(port.checkPort).mockResolvedValue(false)
    vi.mocked(port.getRandomPort).mockResolvedValue(5)

    // When
    const got = await getAvailableTCPPort(666)

    // Then
    expect(got).toBe(5)
  })
})
