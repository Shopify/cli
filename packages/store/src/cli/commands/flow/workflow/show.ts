import {loadConfig} from '../../../services/flow/project-config.js'
import {fetchRemoteWorkflow, normalizeWorkflowJson} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

export default class FlowWorkflowShow extends StoreCommand {
  static hidden = true

  static summary = 'Print a remote workflow definition as normalized JSON.'

  static descriptionWithMarkdown = `Fetches a workflow from the shop and prints its full definition (sorted keys, 2-space indent) to stdout. Doesn't write any files. Use this to inspect a remote workflow without committing to a local file.

To save the result, redirect to a file. To pull and create a tracked local copy with a lockfile, use \`shopify flow workflow pull\`.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> 01HQK000000000000000000000',
    '<%= config.bin %> <%= command.id %> 01HQK... --workflow-version 01HQL... --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> 01HQK... > /tmp/workflow.json',
  ]

  static args = {
    'workflow-id': Args.string({
      description: 'ID of the workflow to show.',
      required: true,
    }),
  }

  static flags = {
    ...globalFlags,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain. Falls back to the `store` field in flow.toml.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    'workflow-version': Flags.string({
      description: 'Optional definition version. Defaults to leading.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_VERSION',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowWorkflowShow)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError(
        'No store. Pass --store, or run `shopify flow init` to create a flow.toml.',
      )
    }

    const remote = await fetchRemoteWorkflow({
      workflowId: args['workflow-id'],
      workflowVersion: flags['workflow-version'],
      store,
    })

    outputResult(normalizeWorkflowJson(remote))
  }
}
