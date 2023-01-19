import {getAnalyticsTunnelType} from './analytics.js'
import {test, expect, describe, vi, beforeEach} from 'vitest'
import {getListOfTunnelPlugins} from '@shopify/cli-kit/node/plugins'

describe('getAnalyticsTunnelType', () => {
  beforeEach(() => {
    vi.mock('@shopify/cli-kit/node/plugins', async () => {
      const actual: any = await vi.importActual('@shopify/cli-kit/node/plugins')
      return {
        ...actual,
        getListOfTunnelPlugins: vi.fn(),
      }
    })
  })

  test('return a provider in case tunnelUrl contains its name', async () => {
    // Given
    const tunnelUrl = 'https://www.existing-provider.com'
    vi.mocked(getListOfTunnelPlugins).mockResolvedValue({plugins: ['existing-provider']})

    // When
    const got = await getAnalyticsTunnelType({} as any, tunnelUrl)

    // Then
    expect(got).toBe('existing-provider')
  })

  test('return a custom in case tunnelUrl is not either localhost or included in the provider plugin list', async () => {
    // Given
    const tunnelUrl = 'https://www.custom-provider.com'
    vi.mocked(getListOfTunnelPlugins).mockResolvedValue({plugins: ['existing-provider']})

    // When
    const got = await getAnalyticsTunnelType({} as any, tunnelUrl)

    // Then
    expect(got).toBe('custom')
  })

  test('when no tunnelUrl is passed then should return undefined', async () => {
    // When
    const got = await getAnalyticsTunnelType({} as any, undefined as any)

    // Then
    expect(got).toBeUndefined()
  })

  test('when a localhost tunnelUrl is passed then should return localhost', async () => {
    // Given
    const tunnelUrl = 'https://localhost'

    // When
    const got = await getAnalyticsTunnelType({} as any, tunnelUrl)

    // Then
    expect(got).toBe('localhost')
  })
})
