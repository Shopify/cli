import {loadConfig} from '../../../services/flow/project-config.js'
import {pushWorkflow} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

export default class FlowWorkflowPush extends StoreCommand {
  static hidden = true

  static summary = 'Push a Flow workflow JSON file to a shop and write a lockfile.'

  static descriptionWithMarkdown =
    'Creates or updates a workflow on the shop. Writes a sibling `.flow.lock.json` with the returned workflow_id, version, and payload SHA. Workflows are pushed `hidden: false` so they can be activated.'

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> ./workflow.flow.json --store shop.myshopify.com',
  ]

  static args = {
    file: Args.string({
      description: 'Path to the workflow JSON file.',
      required: true,
      parse: async (input) => resolvePath(input),
    }),
  }

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain. Falls back to the `store` field in flow.toml.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowWorkflowPush)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const result = await pushWorkflow({
      filePath: args.file,
      store,
    })

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
    } else {
      outputResult(
        `Pushed workflow ${result.workflowId} (version ${result.workflowDefinitionVersion}). Lockfile updated.`,
      )
    }
  }
}
