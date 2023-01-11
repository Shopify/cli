import Logout from './logout.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {outputMocker} from '@shopify/cli-kit'
import {logout} from '@shopify/cli-kit/node/session'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const module: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...module,
      session: {
        ...module.session,
        logout: vi.fn(),
      },
    }
  })
})

describe('logs out', () => {
  it('clears the session', async () => {
    // Given
    const outputMock = outputMocker.mockAndCaptureOutput()

    // When
    await Logout.run()

    // Then
    expect(logout).toHaveBeenCalledOnce()
    expect(outputMock.success()).toMatchInlineSnapshot('"Logged out from Shopify"')
  })
})
