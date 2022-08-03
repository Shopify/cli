import {listenRedirect} from './redirect-listener.js'
import {clientId} from './identity.js'
import {generateRandomChallengePair, randomHex} from '../string.js'
import {open} from '../system.js'
import {Abort, CancelExecution} from '../error.js'
import {identity as identityFqdn} from '../environment/fqdn.js'
import * as output from '../output.js'
import {keypress, terminateBlockingPortProcessPrompt} from '../ui.js'
import {checkPort as isPortAvailable} from 'get-port-please'
import {killPortProcess} from 'kill-port-process'

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

  await validateRedirectionPortAvailability(port)

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

  output.info('\nTo run this command, log in to Shopify Partners.')
  output.info('👉 Press any key to open the login page on your browser')
  await keypress()

  url = `${url}?${new URLSearchParams(params).toString()}`
  open(url)

  const result = await listenRedirect(host, port, url)

  if (result.state !== state) {
    throw MismatchStateError
  }

  return {code: result.code, codeVerifier}
}

async function validateRedirectionPortAvailability(port: number) {
  if (await isPortAvailable(port)) {
    return
  }

  if (await terminateBlockingPortProcessPrompt(port, 'Authentication')) {
    await killPortProcess(port)
  } else {
    throw new CancelExecution()
  }
}
