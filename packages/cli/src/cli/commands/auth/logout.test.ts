import Logout from './logout.js'
import {describe, expect, vi, test} from 'vitest'
import {logout} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session')

describe('logs out', () => {
  test('clears the session', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    await Logout.run()

    // Then
    expect(logout).toHaveBeenCalledOnce()
    expect(outputMock.success()).toMatchInlineSnapshot('"Logged out from all the accounts"')
  })
})
