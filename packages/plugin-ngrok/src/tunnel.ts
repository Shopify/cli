import {TUNNEL_PROVIDER} from './provider.js'
import {os, output, ui, error as cliKitError} from '@shopify/cli-kit'
import {startTunnel, TunnelError, TunnelErrorType} from '@shopify/cli-kit/node/plugins/tunnel'
import ngrok from '@shopify/ngrok'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {err, ok, Result} from '@shopify/cli-kit/common/result'

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
      new cliKitError.Abort(`The ngrok tunnel could not be started.\n\n${error.message}`, buildTryMessage(errorType)),
    )
    return err(new TunnelError(errorType, error.message))
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
  const link = output.token.link(ngrokURL, ngrokURL)
  output.info(output.content`${explanation}To sign up and get an auth token: ${link}\n`)

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
    const {platform} = os.platformAndArch()
    const tryMessage = 'Kill all the ngrok processes with '
    if (platform === 'windows') {
      return tryMessage.concat(output.content`${output.token.genericShellCommand('taskkill /f /im ngrok.exe')}`.value)
    } else {
      return tryMessage.concat(output.content`${output.token.genericShellCommand('killall ngrok')}`.value)
    }
  } else if (errorType === 'wrong-credentials') {
    return output.content`Update your ngrok token with ${output.token.genericShellCommand('shopify ngrok auth')}`.value
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
