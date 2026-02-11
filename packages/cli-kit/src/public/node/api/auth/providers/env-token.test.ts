import {EnvTokenProvider} from './env-token.js'
import {IdentityClient} from '../identity-client.js'
import {getPartnersToken} from '../../../environment.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../environment.js')
vi.mock('../../../../../private/node/session.js', () => ({
  setLastSeenAuthMethod: vi.fn(),
  setLastSeenUserIdAfterAuth: vi.fn(),
}))

function createMockIdentityClient(): IdentityClient {
  return {
    initiateDeviceAuth: vi.fn(),
    pollForDeviceApproval: vi.fn(),
    exchangeAllTokens: vi.fn(),
    refreshIdentityToken: vi.fn(),
    exchangeCustomToken: vi.fn().mockResolvedValue({accessToken: 'exchanged-token', userId: 'user-1'}),
  }
}

describe('EnvTokenProvider', () => {
  test('returns null when SHOPIFY_CLI_PARTNERS_TOKEN is not set', async () => {
    vi.mocked(getPartnersToken).mockReturnValue(undefined)

    const provider = new EnvTokenProvider(createMockIdentityClient())
    const result = await provider.getToken('partners')

    expect(result).toBeNull()
  })

  test('exchanges token for partners audience', async () => {
    vi.mocked(getPartnersToken).mockReturnValue('my-partners-token')
    const client = createMockIdentityClient()
    const provider = new EnvTokenProvider(client)

    const result = await provider.getToken('partners')

    expect(client.exchangeCustomToken).toHaveBeenCalledWith('my-partners-token', 'partners')
    expect(result).toBe('exchanged-token')
  })

  test('exchanges token for app-management audience', async () => {
    vi.mocked(getPartnersToken).mockReturnValue('my-partners-token')
    const client = createMockIdentityClient()
    const provider = new EnvTokenProvider(client)

    const result = await provider.getToken('app-management')

    expect(client.exchangeCustomToken).toHaveBeenCalledWith('my-partners-token', 'app-management')
    expect(result).toBe('exchanged-token')
  })

  test('exchanges token for business-platform audience', async () => {
    vi.mocked(getPartnersToken).mockReturnValue('my-partners-token')
    const client = createMockIdentityClient()
    const provider = new EnvTokenProvider(client)

    const result = await provider.getToken('business-platform')

    expect(client.exchangeCustomToken).toHaveBeenCalledWith('my-partners-token', 'business-platform')
    expect(result).toBe('exchanged-token')
  })

  test('returns null for admin audience even with env token', async () => {
    vi.mocked(getPartnersToken).mockReturnValue('my-partners-token')
    const client = createMockIdentityClient()
    const provider = new EnvTokenProvider(client)

    const result = await provider.getToken('admin')

    expect(result).toBeNull()
    expect(client.exchangeCustomToken).not.toHaveBeenCalled()
  })

  test('returns null for storefront-renderer audience even with env token', async () => {
    vi.mocked(getPartnersToken).mockReturnValue('my-partners-token')
    const client = createMockIdentityClient()
    const provider = new EnvTokenProvider(client)

    const result = await provider.getToken('storefront-renderer')

    expect(result).toBeNull()
    expect(client.exchangeCustomToken).not.toHaveBeenCalled()
  })
})
