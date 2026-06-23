import {loadConfig} from '../../../services/flow/project-config.js'
import {validateWorkflow} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

export default class FlowWorkflowValidate extends StoreCommand {
  static hidden = true

  static summary = 'Validate a Flow workflow JSON file against a shop without persisting.'

  static descriptionWithMarkdown =
    'Runs the same validation as push but in dry-run mode (`is_eval`). No DB writes; returns validation errors against the shop scope.'

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
    const {args, flags} = await this.parse(FlowWorkflowValidate)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const result = await validateWorkflow({
      filePath: args.file,
      store,
    })

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
    } else if (result.validation_errors && result.validation_errors.length > 0) {
      outputResult(`Validation errors:\n${JSON.stringify(result.validation_errors, null, 2)}`)
    } else if (result.error) {
      outputResult(`Error: ${result.error}`)
    } else {
      outputResult('Workflow is valid.')
    }

    if (result.error || (result.validation_errors && result.validation_errors.length > 0)) {
      throw new AbortError('Workflow validation failed.')
    }
  }
}
