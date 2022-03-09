import {describe, it, expect, vi} from 'vitest'

import {randomHex} from '../string'
import {open} from '../system'

import {authorize, MismatchStateError} from './authorize'
import {listenRedirect} from './redirect-listener'

vi.mock('../system')
vi.mock('./redirect-listener')
vi.mock('../string')

const port = 3456
const host = '127.0.0.1'

describe('authorize', () => {
  it('authorizes the user through the browser', async () => {
    // Given
    vi.mocked(randomHex).mockReturnValue('hex')
    vi.mocked(listenRedirect).mockResolvedValue({code: 'code', state: 'state'})

    // When
    const got = await authorize('fqdn.com', 'clientId', ['scope1', 'scope2'], 'state')

    // Then
    const url =
      'http://fqdn.com/oauth/authorize?client_id=clientId&scope=scope1+scope2&redirect_uri=http%3A%2F%2F127.0.0.1%3A3456&state=state&response_type=code&code_challenge_method=S256&code_challenge=Eo3xPB5U%2F6qvzJ0H7HQn1h92QhTmrgMh3iPJTSYdCGA%3D'

    expect(open).toHaveBeenCalledWith(url)
    expect(listenRedirect).toHaveBeenCalledWith(host, port)
    expect(got).toEqual('code')
  })

  it('throws error if the returned state is not valid', async () => {
    // Given
    vi.mocked(randomHex).mockReturnValue('hex')
    vi.mocked(listenRedirect).mockResolvedValue({code: 'code', state: 'bad'})

    // When
    const auth = authorize('fqdn.com', 'clientId', ['scope1', 'scope2'], 'state')

    // Then
    await expect(auth).rejects.toThrowError(MismatchStateError)
  })
})
