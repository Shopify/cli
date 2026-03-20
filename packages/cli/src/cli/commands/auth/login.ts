import Command from '@shopify/cli-kit/node/base-command'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import {startDeviceAuthNoPolling, resumeDeviceAuth} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
import {outputCompleted, outputInfo} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class Login extends Command {
  static description = 'Logs you in to your Shopify account.'

  static flags = {
    alias: Flags.string({
      description: 'Alias of the session you want to login to.',
      env: 'SHOPIFY_FLAG_AUTH_ALIAS',
    }),
    'no-polling': Flags.boolean({
      description: 'Start the login flow without polling. Prints the auth URL and exits immediately.',
      default: false,
      env: 'SHOPIFY_FLAG_AUTH_NO_POLLING',
    }),
    resume: Flags.boolean({
      description: 'Resume a previously started login flow.',
      default: false,
      env: 'SHOPIFY_FLAG_AUTH_RESUME',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)

    if (flags['no-polling']) {
      await startDeviceAuthNoPolling()
      outputInfo('Run `shopify auth login --resume` to complete login after authorizing.')
      return
    }

    if (flags.resume) {
      const result = await resumeDeviceAuth()
      switch (result.status) {
        case 'success':
          outputCompleted(`Logged in as: ${result.alias}`)
          return
        case 'pending':
          throw new AbortError(
            'Authorization is still pending.',
            `Open ${result.verificationUriComplete} to authorize, then run \`shopify auth login --resume\` again.`,
          )
        case 'expired':
        case 'denied':
        case 'no_pending':
          throw new AbortError(result.message)
      }
    }

    // Default: interactive flow
    const result = await promptSessionSelect(flags.alias)
    outputCompleted(`Current account: ${result}.`)
  }
}
