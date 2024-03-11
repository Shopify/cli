import {developerPreviewController} from './dev.js'
import {fetchAppPreviewMode} from './dev/fetch.js'
import {testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./dev/fetch.js')

const developerPlatformClient = testDeveloperPlatformClient()

describe('developerPreviewController', () => {
  test('does not refresh the tokens when they are still valid', async () => {
    // Given
    const {refreshToken} = developerPlatformClient
    const refreshTokenSpy = vi.spyOn(developerPlatformClient, 'refreshToken').mockImplementation(refreshToken)
    const controller = developerPreviewController('apiKey', developerPlatformClient)
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
    expect(refreshTokenSpy).not.toHaveBeenCalled()
  })
  test('refreshes the tokens when they expire', async () => {
    // Given
    const controller = developerPreviewController('apiKey', developerPlatformClient)
    vi.mocked(fetchAppPreviewMode).mockRejectedValueOnce(new Error('expired token'))
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)
    const {refreshToken} = developerPlatformClient
    const refreshTokenSpy = vi.spyOn(developerPlatformClient, 'refreshToken').mockImplementation(refreshToken)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
    expect(refreshTokenSpy).toHaveBeenCalledOnce()
    expect(fetchAppPreviewMode).toHaveBeenCalledTimes(2)
  })
})
