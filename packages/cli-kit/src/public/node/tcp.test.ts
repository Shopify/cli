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
    const got = await getAvailableTCPPort()

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
})
