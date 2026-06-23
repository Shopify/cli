import Command from '@shopify/cli-kit/node/base-command'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderTable, renderInfo} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class WorkflowList extends Command {
  static summary = 'List workflows on a shop.'

  static description = 'Prints every workflow on the shop with id, name, and last-updated timestamp.'

  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...globalFlags,
    store: Flags.string({
      char: 's',
      description: 'Store URL (e.g. my-store.myshopify.com)',
      required: true,
      env: 'SHOPIFY_FLAG_STORE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(WorkflowList)
    const session = await ensureAuthenticatedAdmin(flags.store)

    // TODO: replace stub with real AdminAPI call using session.token + session.storeFqdn
    renderInfo({
      headline: `Authenticated as ${session.storeFqdn}`,
      body: 'Workflow list coming soon — wire in the real AdminAPI query here.',
    })

    renderTable({
      rows: [
        {id: '123', title: 'Example workflow', updatedAt: '2026-06-23'},
      ],
      columns: {
        id: {header: 'ID'},
        title: {header: 'Title'},
        updatedAt: {header: 'Updated'},
      },
    })
  }
}
