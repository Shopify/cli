import {TUNNEL_PROVIDER} from './provider.js'
import {ui} from '@shopify/cli-kit'
import * as output from '@shopify/cli-kit/node/output'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {startTunnel, TunnelError, TunnelErrorType} from '@shopify/cli-kit/node/plugins/tunnel'
import ngrok from '@shopify/ngrok'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {AbortError} from '@shopify/cli-kit/node/error'

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

// New entry point for hooks
export async function hookStart(port: number): Promise<Result<{url: string}, TunnelError>> {
  try {
    const url = await start({port})
    return ok({url})
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const errorType = getErrorType(error.message)
    renderFatalError(
      new AbortError(`The ngrok tunnel could not be started.\n\n${error.message}`, buildTryMessage(errorType)),
    )
    const tunnelError = new TunnelError(errorType, error.message)
    return err(tunnelError)
  }
}

// Old entry point, backwards compatible with old CLI versions
export async function start(options: {port: number}): Promise<string> {
  if (!(await ngrok.validConfig())) {
    const token = await tokenPrompt()
    await authenticate(token)
  }

  return ngrok.connect({proto: 'http', addr: options.port})
}

export async function authenticate(token: string): Promise<void> {
  const validToken = token ?? (await tokenPrompt(false))
  await ngrok.authtoken(validToken)
  await ngrok.upgradeConfig()
}

async function tokenPrompt(showExplanation = true): Promise<string> {
  const explanation = showExplanation
    ? '\nTo make your local code accessible to your dev store, you need to use a ' +
      'Shopify-trusted tunneling service called ngrok. '
    : ''
  const ngrokURL = 'https://dashboard.ngrok.com/get-started/your-authtoken'
  const link = output.outputToken.link(ngrokURL, ngrokURL)
  output.outputInfo(output.outputContent`${explanation}To sign up and get an auth token: ${link}\n`)

  const input: {token: string} = await ui.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Enter your ngrok token.',
      validate: (value) => {
        if (value.length === 0) {
          return "Token can't be empty"
        }
        return true
      },
    },
  ])

  return input.token
}

function buildTryMessage(errorType: TunnelErrorType): string | undefined {
  if (errorType === 'tunnel-already-running') {
    const {platform} = platformAndArch()
    const tryMessage = 'Kill all the ngrok processes with '
    if (platform === 'windows') {
      return tryMessage.concat(
        output.outputContent`${output.outputToken.genericShellCommand('taskkill /f /im ngrok.exe')}`.value,
      )
    } else {
      return tryMessage.concat(output.outputContent`${output.outputToken.genericShellCommand('killall ngrok')}`.value)
    }
  } else if (errorType === 'wrong-credentials') {
    return output.outputContent`Update your ngrok token with ${output.outputToken.genericShellCommand(
      'shopify ngrok auth',
    )}`.value
  }
  return undefined
}

function getErrorType(nrokErrorMessage: string): TunnelErrorType {
  if (/err_ngrok_108/.test(nrokErrorMessage)) {
    return 'tunnel-already-running'
  } else if (/err_ngrok_105|err_ngrok_106|err_ngrok_107/.test(nrokErrorMessage)) {
    return 'wrong-credentials'
  }
  return 'unknown'
}
