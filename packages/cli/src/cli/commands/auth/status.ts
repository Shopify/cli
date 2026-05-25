import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {AuthStatus, getAuthStatus} from '@shopify/cli-kit/node/session'

function serializeAuthStatus(status: AuthStatus): string {
  return JSON.stringify(status, null, 2)
}

function displayAuthStatus(status: AuthStatus): void {
  switch (status.status) {
    case 'authenticated': {
      const account = status.account?.alias ?? status.account?.userId
      outputInfo(`Logged in as ${account}.`)
      return
    }
    case 'needs_refresh': {
      const account = status.account?.alias ?? status.account?.userId
      outputInfo(`Logged in as ${account}, but the session may refresh before use.`)
      return
    }
    case 'not_authenticated': {
      outputInfo('Not logged in. Run `shopify auth login`.')
      return
    }
    case 'invalid': {
      outputInfo('The saved Shopify CLI session is invalid. Run `shopify auth login`.')
    }
  }
}

export default class Status extends Command {
  static summary = 'Show Shopify account authentication status.'

  static descriptionWithMarkdown = `Shows whether Shopify CLI has a usable Shopify account session.

Use \`--json\` for stable machine-readable output. Agents should check this command before starting workflows that need Shopify account authentication.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --json']

  static flags = {
    ...jsonFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Status)
    const status = await getAuthStatus()

    if (flags.json) {
      outputResult(serializeAuthStatus(status))
    } else {
      displayAuthStatus(status)
    }

    if (!status.authenticated) {
      process.exitCode = 1
    }
  }
}
