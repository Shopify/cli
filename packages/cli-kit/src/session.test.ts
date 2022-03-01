import {vi, describe, expect, it} from 'vitest'

import {authorize} from './session'
import {open} from './system'
import {listenRedirect} from './session/redirect-listener'

vi.mock('./system')
vi.mock('./session/redirect-listener')

describe('authorize', () => {
  it('authorizes the user through the browser', async () => {
    // Given
    const fqdn = 'accounts.shopify.com'
    const clientId = '1234'
    const scopes = ['scope']
    const state = 'state'
    vi.mocked(listenRedirect).mockResolvedValue({
      state: 'state',
      code: 'code',
    })

    // When
    const got = await authorize(fqdn, clientId, scopes, state)

    // Then
    expect(got).toEqual('code')
  })
})
