import {clientId} from './identity.js'
import {listenRedirect} from './redirect-listener.js'
import {base64URLEncode, randomBytes, randomHex, sha256} from '../../../public/node/crypto.js'
import {openURL} from '../../../public/node/system.js'
import {AbortError, CancelExecution} from '../../../public/node/error.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {keypress, renderConfirmationPrompt} from '../../../public/node/ui.js'
import {outputInfo} from '../../../public/node/output.js'
import {runWithTimer} from '../../../public/node/metadata.js'
import {checkPort as isPortAvailable} from 'get-port-please'
import findProcess from 'find-process'

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

  outputInfo('\nTo run this command, log in to Shopify.')
  outputInfo('👉 Press any key to open the login page on your browser')
  await keypress()

  url = `${url}?${new URLSearchParams(params).toString()}`
  await openURL(url)

  return runWithTimer('cmd_all_timing_prompts_ms')(async () => {
    const result = await listenRedirect(host, port, url)

    if (result.state !== state) {
      throw new AbortError(
        "The state received from the authentication doesn't match the one that initiated the authentication process.",
      )
    }

    return {code: result.code, codeVerifier}
  })
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

async function terminateBlockingPortProcessPrompt(port: number, stepDescription: string): Promise<boolean> {
  const processInfo = await findProcess('port', port)
  const formattedProcessName =
    processInfo && processInfo.length > 0 && processInfo[0]?.name ? ` (${processInfo[0].name})` : ''

  return renderConfirmationPrompt({
    message: `${stepDescription} requires a port ${port} that's unavailable because it's running another process${formattedProcessName}. Terminate that process?`,
    confirmationMessage: 'Yes, terminate process in order to log in now',
    cancellationMessage: `No, cancel command and try later`,
  })
}
