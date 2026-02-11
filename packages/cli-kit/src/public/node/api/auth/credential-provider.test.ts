import {chainProviders, CredentialProvider} from './credential-provider.js'
import {describe, test, expect, vi} from 'vitest'

function staticProvider(name: string, token: string | null): CredentialProvider {
  return {
    name,
    getToken: vi.fn().mockResolvedValue(token),
  }
}

describe('chainProviders', () => {
  test('returns token from first provider that resolves non-null', async () => {
    const first = staticProvider('first', null)
    const second = staticProvider('second', 'token-from-second')
    const third = staticProvider('third', 'token-from-third')

    const chain = chainProviders(first, second, third)
    const result = await chain.getToken('partners')

    expect(result).toBe('token-from-second')
    expect(first.getToken).toHaveBeenCalledWith('partners', undefined)
    expect(second.getToken).toHaveBeenCalledWith('partners', undefined)
    expect(third.getToken).not.toHaveBeenCalled()
  })

  test('short-circuits on the first non-null result', async () => {
    const first = staticProvider('first', 'token-from-first')
    const second = staticProvider('second', 'token-from-second')

    const chain = chainProviders(first, second)
    const result = await chain.getToken('admin', {storeFqdn: 'store.myshopify.com'})

    expect(result).toBe('token-from-first')
    expect(first.getToken).toHaveBeenCalledWith('admin', {storeFqdn: 'store.myshopify.com'})
    expect(second.getToken).not.toHaveBeenCalled()
  })

  test('returns null when all providers return null', async () => {
    const first = staticProvider('first', null)
    const second = staticProvider('second', null)

    const chain = chainProviders(first, second)
    const result = await chain.getToken('partners')

    expect(result).toBeNull()
    expect(first.getToken).toHaveBeenCalled()
    expect(second.getToken).toHaveBeenCalled()
  })

  test('passes context through to all providers', async () => {
    const first = staticProvider('first', null)
    const second = staticProvider('second', 'token')

    const chain = chainProviders(first, second)
    const context = {storeFqdn: 'test.myshopify.com', extraScopes: ['custom'], forceRefresh: true}
    await chain.getToken('admin', context)

    expect(first.getToken).toHaveBeenCalledWith('admin', context)
    expect(second.getToken).toHaveBeenCalledWith('admin', context)
  })

  test('propagates errors from providers', async () => {
    const failing: CredentialProvider = {
      name: 'failing',
      getToken: vi.fn().mockRejectedValue(new Error('Exchange failed')),
    }
    const fallback = staticProvider('fallback', 'fallback-token')

    const chain = chainProviders(failing, fallback)

    await expect(chain.getToken('partners')).rejects.toThrow('Exchange failed')
    expect(fallback.getToken).not.toHaveBeenCalled()
  })

  test('composes a descriptive name', () => {
    const chain = chainProviders(staticProvider('EnvToken', null), staticProvider('OAuthSession', null))

    expect(chain.name).toBe('Chain(EnvToken, OAuthSession)')
  })

  test('works with empty provider list', async () => {
    const chain = chainProviders()
    const result = await chain.getToken('partners')
    expect(result).toBeNull()
  })
})
