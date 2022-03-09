import crypto from 'crypto'

import {randomHex} from '../string'
import {open} from '../system'
import {Abort} from '../error'

import {listenRedirect} from './redirect-listener'

export const MismatchStateError = new Abort(
  "The state received from the authentication doesn't match the one that initiated the authentication process.",
)

export async function authorize(
  fqdn: string,
  clientId: string,
  scopes: string[],
  state: string = randomHex(30),
): Promise<string> {
  let url = `http://${fqdn}/oauth/authorize`
  const port = 3456
  const host = '127.0.0.1'
  const redirectUri = `http://${host}:${port}`
  const codeVerifier = randomHex(30)
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64')

  /* eslint-disable @typescript-eslint/naming-convention */
  const params = {
    client_id: clientId,
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
  return result.code
}
