import {confirmReleasePrompt} from './release.js'
import {describe, expect, vi, test} from 'vitest'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/ui')

describe('confirmReleasePrompt', () => {
  test('returns without error in case the user confirm the release prompt', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When/ Then
    await expect(confirmReleasePrompt('test app')).resolves
  })

  test('throws a silent exception in case the user rejects the release prompt', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When/ Then
    await expect(confirmReleasePrompt('test app')).rejects.toThrow(AbortSilentError)
  })
})
