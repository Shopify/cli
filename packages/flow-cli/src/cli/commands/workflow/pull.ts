import Command from '@shopify/cli-kit/node/base-command'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class WorkflowPull extends Command {
  static summary = 'Pull a workflow from a shop to a local file.'

  static description =
    'Downloads the workflow definition for the given id and writes it to a local JSON file.'

  static examples = [
    '<%= config.bin %> <%= command.id %> --workflow-id 123',
    '<%= config.bin %> <%= command.id %> --workflow-id 123 --store my-store.myshopify.com',
  ]

  static flags = {
    ...globalFlags,
    store: Flags.string({
      char: 's',
      description: 'Store URL (e.g. my-store.myshopify.com)',
      required: true,
      env: 'SHOPIFY_FLAG_STORE',
    }),
    'workflow-id': Flags.string({
      description: 'ID of the workflow to pull',
      required: true,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path',
      default: 'workflow.json',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(WorkflowPull)
    const session = await ensureAuthenticatedAdmin(flags.store)

    // TODO: replace stub with real AdminAPI call
    renderWarning({
      headline: 'Stub — not yet implemented',
      body: [
        `Would pull workflow ${flags['workflow-id']} from ${session.storeFqdn}`,
        `and write to ${flags.output}.`,
      ],
    })

    renderSuccess({headline: `Workflow ${flags['workflow-id']} pulled to ${flags.output}`})
  }
}
