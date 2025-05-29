import Login from './login.js'
import {describe, expect, vi, test} from 'vitest'
import {ensureAuthenticatedPartners, logout} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session')

describe('logs in', () => {
  test('clears the session and authenticates with Partners API', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    await Login.run()

    // Then
    expect(logout).toHaveBeenCalledOnce()
    expect(ensureAuthenticatedPartners).toHaveBeenCalledOnce()
    expect(outputMock.success()).toMatchInlineSnapshot('"Successfully logged in to Shopify"')
  })
})
