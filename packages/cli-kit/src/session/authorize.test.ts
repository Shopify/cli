import {authorize, MismatchStateError} from './authorize'
import {listenRedirect} from './redirect-listener'
import {clientId} from './identity'
import {generateRandomChallengePair, randomHex} from '../string'
import {open} from '../system'
import {identity} from '../environment/fqdn'

import {describe, it, expect, vi} from 'vitest'

vi.mock('../system')
vi.mock('./redirect-listener')
vi.mock('../string')
vi.mock('../environment/fqdn')
vi.mock('./identity')

const port = 3456
const host = '127.0.0.1'

describe('authorize', () => {
  it('authorizes the user through the browser', async () => {
    // Given
    const challenge = {
      codeChallenge: 'challenge',
      codeVerifier: 'verifier',
    }
    vi.mocked(randomHex).mockReturnValue('hex')
    vi.mocked(generateRandomChallengePair).mockReturnValue(challenge)
    vi.mocked(listenRedirect).mockResolvedValue({code: 'code', state: 'state'})
    vi.mocked(identity).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockResolvedValue('clientId')

    // When
    const got = await authorize(['scope1', 'scope2'], 'state')

    // Then
    const url =
      'http://fqdn.com/oauth/authorize?client_id=clientId&scope=scope1+scope2&redirect_uri=http%3A%2F%2F127.0.0.1%3A3456&state=state&response_type=code&code_challenge_method=S256&code_challenge=challenge'

    expect(open).toHaveBeenCalledWith(url)
    expect(listenRedirect).toHaveBeenCalledWith(host, port)
    expect(got).toEqual({code: 'code', codeVerifier: challenge.codeVerifier})
  })

  it('throws error if the returned state is not valid', async () => {
    // Given
    vi.mocked(randomHex).mockReturnValue('hex')
    vi.mocked(listenRedirect).mockResolvedValue({code: 'code', state: 'bad'})
    vi.mocked(generateRandomChallengePair).mockReturnValue({
      codeChallenge: 'challenge',
      codeVerifier: 'verifier',
    })

    // When
    const auth = authorize(['scope1', 'scope2'], 'state')

    // Then
    await expect(auth).rejects.toThrowError(MismatchStateError)
  })
})
