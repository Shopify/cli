import {authStatusService} from './auth-status.js'
import {getAuthStatus} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')

describe('authStatusService', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  afterEach(() => {
    mockAndCaptureOutput().clear()
    process.exitCode = undefined
  })

  test('prints authenticated status as text', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(getAuthStatus).mockResolvedValue({
      status: 'authenticated',
      authenticated: true,
      account: {userId: 'user-id', alias: 'user@example.com'},
      identityFqdn: 'accounts.shopify.com',
      expiresAt: '2030-01-01T00:00:00.000Z',
      agentGuidance: {
        instruction: 'A Shopify CLI session is available. Continue with the requested Shopify CLI command.',
      },
    })

    // When
    await authStatusService(false)

    // Then
    expect(outputMock.info()).toBe('Logged in as user@example.com.')
    expect(process.exitCode).toBeUndefined()
  })

  test('prints status as JSON', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    const status = {
      status: 'not_authenticated' as const,
      authenticated: false,
      identityFqdn: 'accounts.shopify.com',
      agentGuidance: {
        instruction:
          'No usable Shopify CLI session is available. Run `shopify auth login`, show the verification URL and user code to the user, and keep the command running until authentication completes.',
        nextCommand: 'shopify auth login',
      },
    }
    vi.mocked(getAuthStatus).mockResolvedValue(status)

    // When
    await authStatusService(true)

    // Then
    expect(JSON.parse(outputMock.output())).toEqual(status)
    expect(process.exitCode).toBe(1)
  })

  test('sets a failing exit code when not authenticated', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(getAuthStatus).mockResolvedValue({
      status: 'not_authenticated',
      authenticated: false,
      identityFqdn: 'accounts.shopify.com',
      agentGuidance: {
        instruction:
          'No usable Shopify CLI session is available. Run `shopify auth login`, show the verification URL and user code to the user, and keep the command running until authentication completes.',
        nextCommand: 'shopify auth login',
      },
    })

    // When
    await authStatusService(false)

    // Then
    expect(outputMock.info()).toBe('Not logged in. Run `shopify auth login`.')
    expect(process.exitCode).toBe(1)
  })
})
