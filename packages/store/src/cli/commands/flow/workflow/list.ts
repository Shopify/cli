import {loadConfig} from '../../../services/flow/project-config.js'
import {listAllWorkflows} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class FlowWorkflowList extends StoreCommand {
  static hidden = true

  static summary = 'List remote workflows on a shop.'

  static descriptionWithMarkdown = `Prints every workflow on the shop with id, name, hidden flag, and last-updated timestamp. Doesn't read or modify any local files.

Use this to discover workflow IDs for \`shopify flow workflow show <id>\` or \`shopify flow workflow pull --workflow-id <id>\`. For a project-scoped view that also classifies local files, use \`shopify flow workflow status\`.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --include-hidden --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain. Falls back to flow.toml.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    'include-hidden': Flags.boolean({
      description: 'Include hidden workflows.',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(FlowWorkflowList)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const workflows = await listAllWorkflows({store, includeHidden: flags['include-hidden']})

    if (flags.json) {
      outputResult(JSON.stringify({store, total: workflows.length, workflows}, null, 2))
      return
    }

    if (workflows.length === 0) {
      outputResult(`No workflows on ${store}.`)
      return
    }

    const nameWidth = Math.max(4, ...workflows.map((workflow) => workflow.name.length))
    const idWidth = Math.max(2, ...workflows.map((workflow) => workflow.workflow_id.length))

    const lines = [
      `${'NAME'.padEnd(nameWidth)}  ${'ID'.padEnd(idWidth)}  HIDDEN  UPDATED`,
      ...workflows.map(
        (workflow) =>
          `${workflow.name.padEnd(nameWidth)}  ${workflow.workflow_id.padEnd(idWidth)}  ${
            workflow.hidden ? 'yes   ' : 'no    '
          }  ${workflow.last_updated ?? '—'}`,
      ),
    ]
    outputResult(lines.join('\n'))
  }
}
