import Command from '@shopify/cli-kit/node/base-command'
import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
import {getAuthStatus, resumeDeviceAuthLogin, startDeviceAuthLogin} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputCompleted, outputInfo} from '@shopify/cli-kit/node/output'
import {isTTY} from '@shopify/cli-kit/node/ui'

export default class Login extends Command {
  static summary = 'Log in to a Shopify account.'

  static descriptionWithMarkdown = `Logs in to a Shopify account using a browser-based device authentication flow.

In an interactive terminal, Shopify CLI opens or prints a verification URL and waits for authentication to complete.

In a non-TTY environment, Shopify CLI first returns the current account if a usable session already exists. If no session exists, it starts device authorization, prints the verification URL and user code, and exits without waiting. After the user authorizes in a browser, run \`shopify auth login --resume\` to exchange the pending device code and store the session.

Use \`--new\` to start a new login instead of reusing an existing session or choosing from saved accounts.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --new',
    '<%= config.bin %> <%= command.id %> --resume',
    '<%= config.bin %> <%= command.id %> --alias my-account',
  ]

  static flags = {
    alias: Flags.string({
      description: 'Alias of the session you want to login to.',
      env: 'SHOPIFY_FLAG_AUTH_ALIAS',
    }),
    resume: Flags.boolean({
      description: 'Resume a pending non-interactive login flow.',
      default: false,
      env: 'SHOPIFY_FLAG_AUTH_RESUME',
    }),
    new: Flags.boolean({
      description: 'Log in with a new account instead of choosing from existing sessions.',
      default: false,
      env: 'SHOPIFY_FLAG_AUTH_NEW',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)

    if (flags.resume) {
      const result = await resumeDeviceAuthLogin()
      switch (result.status) {
        case 'success':
          outputCompleted(`Current account: ${result.alias}.`)
          return
        case 'pending':
          throw new AbortError(
            'Authorization is still pending.',
            `Open ${result.verificationUriComplete} and enter ${result.userCode}, then run \`shopify auth login --resume\` again.`,
          )
        case 'expired':
        case 'denied':
        case 'no_pending':
          throw new AbortError(result.message)
      }
    }

    if (!isTTY()) {
      if (!flags.new) {
        const authStatus = await getAuthStatus()
        if (authStatus.authenticated) {
          const account = authStatus.account?.alias ?? authStatus.account?.userId
          outputCompleted(`Current account: ${account}.`)
          return
        }
      }

      await startDeviceAuthLogin()
      outputInfo('After authorizing, run `shopify auth login --resume` to complete login.')
      return
    }

    const result = flags.new
      ? await promptSessionSelect(flags.alias, {forceNewSession: true})
      : await promptSessionSelect(flags.alias)
    outputCompleted(`Current account: ${result}.`)
  }
}
