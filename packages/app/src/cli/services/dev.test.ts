import {developerPreviewController} from './dev.js'
import {fetchAppPreviewMode} from './dev/fetch.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('./dev/fetch.js')

describe('developerPreviewController', () => {
  test('does not refresh the tokens when they are still valid', async () => {
    // Given
    const controller = developerPreviewController('apiKey', 'originalToken')
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
  })
  test('refreshes the tokens when they expire', async () => {
    // Given
    const controller = developerPreviewController('apiKey', 'originalToken')
    vi.mocked(fetchAppPreviewMode).mockRejectedValueOnce(new Error('expired token'))
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValueOnce('newToken')
    vi.mocked(fetchAppPreviewMode).mockResolvedValueOnce(true)

    // When
    const got = await controller.fetchMode()

    // Then
    expect(got).toBe(true)
    expect(ensureAuthenticatedPartners).toHaveBeenCalledOnce()
    expect(fetchAppPreviewMode).toHaveBeenNthCalledWith(1, 'apiKey', 'originalToken')
    expect(fetchAppPreviewMode).toHaveBeenNthCalledWith(2, 'apiKey', 'newToken')
  })
})
