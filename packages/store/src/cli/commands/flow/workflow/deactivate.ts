import {loadConfig} from '../../../services/flow/project-config.js'
import {deactivateWorkflow} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

export default class FlowWorkflowDeactivate extends StoreCommand {
  static hidden = true

  static summary = 'Deactivate a workflow on a shop.'

  static descriptionWithMarkdown =
    'Deactivates a workflow definition. Same input modes as `activate`: positional file (lockfile), `--workflow-id` + `--workflow-version`, or `--workflow-id` + `--use-latest`.'

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> ./workflow.flow.json --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --workflow-id 01HQK... --workflow-version 01HQL... --store shop.myshopify.com',
  ]

  static args = {
    file: Args.string({
      description: 'Optional path to the workflow JSON file (lockfile drives deactivation).',
      required: false,
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
    'workflow-id': Flags.string({
      description: 'Workflow ID (escape hatch when no lockfile).',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_ID',
    }),
    'workflow-version': Flags.string({
      description: 'Workflow definition version. Required with --workflow-id unless --use-latest.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_VERSION',
    }),
    'use-latest': Flags.boolean({
      description: 'Resolve the latest main version via workflow_lookup.',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowWorkflowDeactivate)

    if (flags['workflow-id'] && !flags['workflow-version'] && !flags['use-latest']) {
      throw new AbortError('--workflow-id requires --workflow-version or --use-latest.')
    }

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const result = await deactivateWorkflow({
      filePath: args.file,
      store,
      workflowId: flags['workflow-id'],
      workflowVersion: flags['workflow-version'],
      useLatest: flags['use-latest'],
    })

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
    } else if (result.error) {
      outputResult(`Error: ${result.error}${result.error_code ? ` (${result.error_code})` : ''}`)
      throw new AbortError('Workflow deactivation failed.')
    } else {
      const version = result.workflow_definition_version ?? result.workflow_version
      outputResult(`Deactivated workflow ${result.workflow_id} (version ${version}).`)
    }
  }
}
