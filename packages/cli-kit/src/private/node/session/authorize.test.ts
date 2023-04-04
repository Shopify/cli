import {authorize} from './authorize.js'
import {clientId} from './identity.js'
import {listenRedirect} from './redirect-listener.js'
import {randomHex, base64URLEncode} from '../../../public/node/crypto.js'
import {openURL} from '../../../public/node/system.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {CancelExecution} from '../../../public/node/error.js'
import {renderConfirmationPrompt} from '../../../public/node/ui.js'
import {checkPort} from 'get-port-please'
import {killPortProcess} from 'kill-port-process'

import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../public/node/system.js')
vi.mock('./redirect-listener')
vi.mock('../../../public/node/crypto.js')
vi.mock('../../../public/node/ui.js')
vi.mock('../../../public/node/context/fqdn.js')
vi.mock('./identity')
vi.mock('get-port-please')
vi.mock('kill-port-process')

const port = 3456
const host = '127.0.0.1'

describe('authorize', () => {
  test('authorizes the user through the browser', async () => {
    // Given
    const challenge = {
      codeChallenge: 'challenge',
      codeVerifier: 'verifier',
    }
    vi.mocked(checkPort).mockResolvedValue(port)
    vi.mocked(randomHex).mockReturnValue('hex')
    vi.mocked(base64URLEncode).mockReturnValueOnce('verifier')
    vi.mocked(base64URLEncode).mockReturnValueOnce('challenge')
    vi.mocked(listenRedirect).mockResolvedValue({code: 'code', state: 'state'})
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When
    const got = await authorize(['scope1', 'scope2'], 'state')

    // Then
    const url =
      'http://fqdn.com/oauth/authorize?client_id=clientId&scope=scope1+scope2&redirect_uri=http%3A%2F%2F127.0.0.1%3A3456&state=state&response_type=code&code_challenge_method=S256&code_challenge=challenge'

    expect(openURL).toHaveBeenCalledWith(url)
    expect(listenRedirect).toHaveBeenCalledWith(host, port, url)
    expect(got).toEqual({code: 'code', codeVerifier: challenge.codeVerifier})
  })

  test('throws error if the returned state is not valid', async () => {
    // Given
    vi.mocked(checkPort).mockResolvedValue(port)
    vi.mocked(randomHex).mockReturnValue('hex')
    vi.mocked(listenRedirect).mockResolvedValue({code: 'code', state: 'bad'})

    // When
    const auth = () => authorize(['scope1', 'scope2'], 'state')

    // Then
    await expect(auth).rejects.toThrowError(/authentication doesn't match/)
  })

  test('throws cancel execution exception if the port used for listening for the authorization response is already in use and the user do not want to terminate the process', async () => {
    // Given
    vi.mocked(checkPort).mockResolvedValue(false)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    const auth = authorize(['scope1', 'scope2'], 'state')

    // Then
    await expect(auth).rejects.toThrowError(new CancelExecution())
    expect(killPortProcess).toBeCalledTimes(0)
  })

  test('terminate process if the port used for listing for the authorization response is already in use and the user confirm to terminate the process', async () => {
    // Given
    const challenge = {
      codeChallenge: 'challenge',
      codeVerifier: 'verifier',
    }
    vi.mocked(randomHex).mockReturnValue('hex')
    vi.mocked(base64URLEncode).mockReturnValueOnce('verifier')
    vi.mocked(base64URLEncode).mockReturnValueOnce('challenge')
    vi.mocked(listenRedirect).mockResolvedValue({code: 'code', state: 'state'})
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')
    vi.mocked(checkPort).mockResolvedValue(false)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const got = await authorize(['scope1', 'scope2'], 'state')

    // Then
    const url =
      'http://fqdn.com/oauth/authorize?client_id=clientId&scope=scope1+scope2&redirect_uri=http%3A%2F%2F127.0.0.1%3A3456&state=state&response_type=code&code_challenge_method=S256&code_challenge=challenge'

    expect(openURL).toHaveBeenCalledWith(url)
    expect(listenRedirect).toHaveBeenCalledWith(host, port, url)
    expect(got).toEqual({code: 'code', codeVerifier: challenge.codeVerifier})
    expect(killPortProcess).toHaveBeenCalledOnce()
  })
})
