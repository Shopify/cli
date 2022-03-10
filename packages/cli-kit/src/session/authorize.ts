import {generateRandomChallengePair, randomHex} from '../string'
import {open} from '../system'
import {Abort} from '../error'
import {identity as identityFqdn} from '../environment/fqdn'

import {listenRedirect} from './redirect-listener'
import {clientId} from './identity'

export const MismatchStateError = new Abort(
  "The state received from the authentication doesn't match the one that initiated the authentication process.",
)

export interface CodeAuthResult {
  code: string
  codeVerifier: string
}

export async function authorize(scopes: string[], state: string = randomHex(30)): Promise<CodeAuthResult> {
  const port = 3456
  const host = '127.0.0.1'
  const redirectUri = `http://${host}:${port}`
  const fqdn = await identityFqdn()
  const identityClientId = await clientId()

  let url = `http://${fqdn}/oauth/authorize`

  const {codeVerifier, codeChallenge} = generateRandomChallengePair()

  /* eslint-disable @typescript-eslint/naming-convention */
  const params = {
    client_id: identityClientId,
    scope: scopes.join(' '),
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  }
  /* eslint-enable @typescript-eslint/naming-convention */

  url = `${url}?${new URLSearchParams(params).toString()}`
  open(url)
  const result = await listenRedirect(host, port)

  if (result.state !== state) {
    throw MismatchStateError
  }

  return {code: result.code, codeVerifier}
}
