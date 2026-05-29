import {authStatusService} from '../../services/commands/auth-status.js'
import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'

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
    await authStatusService(flags.json)
  }
}
