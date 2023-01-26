import {clientId} from './identity.js'
import {listenRedirect} from './redirect-listener.js'
import {base64URLEncode, randomBytes, randomHex, sha256} from '../../../public/node/crypto.js'
import {openURL} from '../../../public/node/system.js'
import {AbortError, CancelExecution} from '../../../public/node/error.js'
import {identityFqdn} from '../../../public/node/environment/fqdn.js'
import {keypress, terminateBlockingPortProcessPrompt} from '../../../ui.js'
import {checkPort as isPortAvailable} from 'get-port-please'
import {outputInfo} from '@shopify/cli-kit/node/output'

export interface CodeAuthResult {
  code: string
  codeVerifier: string
}

export async function authorize(scopes: string[], state: string = randomHex(30)): Promise<CodeAuthResult> {
  const port = 3456
  const host = '127.0.0.1'
  const redirectUri = `http://${host}:${port}`
  const fqdn = await identityFqdn()
  const identityClientId = clientId()

  await validateRedirectionPortAvailability(port)

  let url = `http://${fqdn}/oauth/authorize`

  const {codeVerifier, codeChallenge} = generateRandomChallengePair()

  const params = {
    client_id: identityClientId,
    scope: scopes.join(' '),
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  }

  outputInfo('\nTo run this command, log in to Shopify Partners.')
  outputInfo('👉 Press any key to open the login page on your browser')
  await keypress()

  url = `${url}?${new URLSearchParams(params).toString()}`
  await openURL(url)

  const result = await listenRedirect(host, port, url)

  if (result.state !== state) {
    throw new AbortError(
      "The state received from the authentication doesn't match the one that initiated the authentication process.",
    )
  }

  return {code: result.code, codeVerifier}
}

function generateRandomChallengePair() {
  const codeVerifier = base64URLEncode(randomBytes(32))
  const codeChallenge = base64URLEncode(sha256(codeVerifier))
  return {codeVerifier, codeChallenge}
}

async function validateRedirectionPortAvailability(port: number) {
  const {killPortProcess} = await import('kill-port-process')

  if (await isPortAvailable(port)) {
    return
  }

  if (await terminateBlockingPortProcessPrompt(port, 'Authentication')) {
    await killPortProcess(port)
  } else {
    throw new CancelExecution()
  }
}
