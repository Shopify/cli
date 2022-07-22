import {authorize, MismatchStateError} from './authorize.js'
import {listenRedirect} from './redirect-listener.js'
import {clientId} from './identity.js'
import {generateRandomChallengePair, randomHex} from '../string.js'
import {open} from '../system.js'
import {identity} from '../environment/fqdn.js'
import {checkPort} from 'get-port-please'

import {describe, it, expect, vi} from 'vitest'

vi.mock('../system')
vi.mock('./redirect-listener')
vi.mock('../string')
vi.mock('../environment/fqdn')
vi.mock('./identity')
vi.mock('../ui')
vi.mock('get-port-please')

const port = 3456
const host = '127.0.0.1'

describe('authorize', () => {
  it('authorizes the user through the browser', async () => {
    // Given
    const challenge = {
      codeChallenge: 'challenge',
      codeVerifier: 'verifier',
    }
    vi.mocked(checkPort).mockResolvedValue(port)
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
    expect(listenRedirect).toHaveBeenCalledWith(host, port, url)
    expect(got).toEqual({code: 'code', codeVerifier: challenge.codeVerifier})
  })

  it('throws error if the returned state is not valid', async () => {
    // Given
    vi.mocked(checkPort).mockResolvedValue(port)
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

  it('throws error if the port used for listing for the authorization response is already in use', async () => {
    // Given
    vi.mocked(checkPort).mockResolvedValue(false)

    // When
    const auth = authorize(['scope1', 'scope2'], 'state')

    // Then
    await expect(auth).rejects.toThrowError(
      `Could not open browser for authorization process. Port [33m${port}[39m already in use`,
    )
    await expect(auth).rejects.toContain({
      tryMessage: `Please, locate and finish the process that it is using the port [33m${port}[39m`,
    })
    await expect(open).not.toBeCalled()
  })
})
