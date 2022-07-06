import {getRandomPort} from './port'
import * as System from './system'
import {Abort} from './error'
import * as port from 'get-port-please'
import {beforeEach, describe, expect, it, vi} from 'vitest'

beforeEach(() => {
  vi.mock('get-port-please')
})

const errorMessage = 'Unable to generate random port'

describe('getRandomPort', () => {
  it('returns random port if the number retries is not exceeded', async () => {
    // Given
    vi.mocked(port.getRandomPort).mockRejectedValueOnce(new Error(errorMessage))
    vi.mocked(port.getRandomPort).mockResolvedValue(5)
    const debugError = vi.spyOn(System, 'sleep')

    // When
    const got = await getRandomPort()

    // Then
    expect(got).toBe(5)
    expect(debugError).toHaveBeenCalledOnce()
  })

  it('throws an abort exception with same error message received from third party getRandomPort if the number retries is exceeded', async () => {
    // Given
    const maxTries = 5
    for (let i = 0; i < maxTries; i++) {
      vi.mocked(port.getRandomPort).mockRejectedValueOnce(new Error(errorMessage))
    }

    // When/Then
    await expect(getRandomPort()).rejects.toThrowError(new Abort(errorMessage))
  })
})
