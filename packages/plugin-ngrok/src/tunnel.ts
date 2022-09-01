import {TUNNEL_PROVIDER} from './provider.js'
import {error, os, output, ui} from '@shopify/cli-kit'
import {startTunnel} from '@shopify/cli-kit/plugins/tunnel'
import ngrok from '@shopify/ngrok'

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

export const NgrokError = (ngrokErrorMessage: string) => {
  return new error.Abort(
    `The ngrok tunnel could not be started.\n\n${ngrokErrorMessage}`,
    buildTryMessage(ngrokErrorMessage),
  )
}

// New entry point for hooks
export async function hookStart(port: number): Promise<{url: string | undefined}> {
  try {
    const url = await start({port})
    return {url}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    await output.error(error as error.Abort)
    return {url: undefined}
  }
}

// Old entry point, backwards compatible with old CLI versions
export async function start(options: {port: number}): Promise<string> {
  if (!(await ngrok.validConfig())) {
    const token = await tokenPrompt()
    await authenticate(token)
  }

  const url = await ngrok.connect({proto: 'http', addr: options.port}).catch((err: Error) => {
    throw NgrokError(err.message)
  })
  return url
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

function buildTryMessage(nrokErrorMessage: string): string | undefined {
  if (/err_ngrok_108/.test(nrokErrorMessage)) {
    const {platform} = os.platformAndArch()
    const tryMessage = 'Kill all the ngrok processes with '
    if (platform === 'windows') {
      return tryMessage.concat(output.content`${output.token.genericShellCommand('taskkill /f /im ngrok.exe')}`.value)
    } else {
      return tryMessage.concat(output.content`${output.token.genericShellCommand('killall ngrok')}`.value)
    }
  } else if (/err_ngrok_105|err_ngrok_106|err_ngrok_107/.test(nrokErrorMessage)) {
    return output.content`Update your ngrok token with ${output.token.genericShellCommand('shopify ngrok auth')}`.value
  }
  return undefined
}
