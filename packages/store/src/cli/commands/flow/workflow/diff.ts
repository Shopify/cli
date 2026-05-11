import {loadConfig} from '../../../services/flow/project-config.js'
import {diffWorkflow, normalizeWorkflowJson, readWorkflowFile, unifiedDiff} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

export default class FlowWorkflowDiff extends StoreCommand {
  static summary = 'Show the diff between a local workflow file and the remote workflow.'

  static descriptionWithMarkdown = `Compares a local Flow workflow file against the remote workflow on the shop. Both sides are normalized (sorted keys, stable indent) so the diff reflects real changes, not formatting noise.

Default direction is \`--- remote\` / \`+++ local\` so added lines = what \`push\` would change.

Exit code: 0 if no differences, 1 if differences found.

To inspect a remote workflow without a local file, use \`shopify flow workflow show <id>\`.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> ./workflow.flow.json --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> ./workflow.flow.json --json',
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
    'workflow-id': Flags.string({
      description: 'Compare against a specific workflow ID instead of the lockfile.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_ID',
    }),
    'workflow-version': Flags.string({
      description: 'Optional definition version override.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_VERSION',
    }),
    'local-only': Flags.boolean({
      description: 'Print the normalized local workflow only (no diff).',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowWorkflowDiff)

    if (flags['local-only']) {
      const local = await readWorkflowFile(args.file)
      outputResult(normalizeWorkflowJson(local))
      return
    }

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError(
        'No store. Pass --store, or run `shopify flow init` to create a flow.toml.',
      )
    }

    const result = await diffWorkflow({
      filePath: args.file,
      store,
      workflowId: flags['workflow-id'],
      workflowVersion: flags['workflow-version'],
    })

    if (flags.json) {
      outputResult(
        JSON.stringify(
          {changed: result.changed, local: result.localNormalized, remote: result.remoteNormalized},
          null,
          2,
        ),
      )
    } else if (result.changed) {
      const remoteLabel = `remote: ${store}`
      const localLabel = `local: ${args.file}`
      outputResult(unifiedDiff(remoteLabel, result.remoteNormalized, localLabel, result.localNormalized))
    }

    if (result.changed) {
      process.exitCode = 1
    }
  }
}
