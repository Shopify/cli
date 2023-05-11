import {TUNNEL_PROVIDER} from './provider.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {startTunnel, TunnelError, TunnelErrorType, TunnelStartReturn} from '@shopify/cli-kit/node/plugins/tunnel'
import ngrok from '@shopify/ngrok'
import {renderFatalError, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {err, ok} from '@shopify/cli-kit/node/result'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputToken, outputInfo, outputContent} from '@shopify/cli-kit/node/output'

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

// New entry point for hooks
export async function hookStart(port: number): Promise<TunnelStartReturn> {
  try {
    const url = await start({port})
    return ok({
      getTunnelStatus: () => {
        return {status: 'connected', url}
      },
      stopTunnel: () => ngrok.kill(),
      provider: TUNNEL_PROVIDER,
      port,
    })
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
  const link = outputToken.link(ngrokURL, ngrokURL)
  outputInfo(outputContent`${explanation}To sign up and get an auth token: ${link}\n`)

  return renderTextPrompt({
    password: true,
    message: 'Enter your ngrok token',
    validate: (value) => {
      if (value.length === 0) {
        return "Token can't be empty"
      }
    },
  })
}

function buildTryMessage(errorType: TunnelErrorType): string | undefined {
  if (errorType === 'tunnel-already-running') {
    const {platform} = platformAndArch()
    const tryMessage = 'Kill all the ngrok processes with '
    if (platform === 'windows') {
      return tryMessage.concat(outputContent`${outputToken.genericShellCommand('taskkill /f /im ngrok.exe')}`.value)
    } else {
      return tryMessage.concat(outputContent`${outputToken.genericShellCommand('killall ngrok')}`.value)
    }
  } else if (errorType === 'wrong-credentials') {
    return outputContent`Update your ngrok token with ${outputToken.genericShellCommand('shopify ngrok auth')}`.value
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
