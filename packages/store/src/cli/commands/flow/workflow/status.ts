import {loadConfig, workflowsDirAbsolute} from '../../../services/flow/project-config.js'
import {statusProject, type StatusItem, type WorkflowStatus} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  clean: 'clean',
  drifted: 'drifted',
  new: 'new',
  orphaned: 'orphaned',
  unknown: 'unknown',
}

export default class FlowWorkflowStatus extends StoreCommand {
  static hidden = true

  static summary = 'Show drift between local workflow files and the shop.'

  static descriptionWithMarkdown = `Walks the project's workflows directory and classifies every workflow:

- \`clean\` — local file matches the remote workflow
- \`drifted\` — local file and remote differ; \`push\` would update remote, \`pull\` would update local
- \`new\` — local file with no lockfile; never pushed
- \`orphaned\` — lockfile points to a workflow that no longer exists on the shop
- \`unknown\` — workflow exists on the shop but isn't tracked locally; \`pull --workflow-id <id>\` to bring it in

Exits 1 if anything other than \`clean\` is present.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain. Falls back to the `store` field in flow.toml.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    'workflows-dir': Flags.string({
      description: 'Directory containing workflow JSON files. Falls back to flow.toml.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOWS_DIR',
    }),
    'include-hidden': Flags.boolean({
      description: 'Include hidden remote workflows in the unknown-detection list.',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(FlowWorkflowStatus)

    const config = await loadConfig()
    const store = flags.store ?? config?.store
    if (!store) {
      throw new AbortError(
        'No store. Pass --store, or run `shopify flow init` to create a flow.toml.',
      )
    }
    const dir = flags['workflows-dir']
      ? resolvePath(cwd(), flags['workflows-dir'])
      : config
        ? workflowsDirAbsolute(config)
        : undefined
    if (!dir) {
      throw new AbortError(
        'No workflows directory. Pass --workflows-dir, or run `shopify flow init`.',
      )
    }

    const result = await statusProject({store, workflowsDir: dir, includeHidden: flags['include-hidden']})

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
    } else {
      outputResult(formatHuman(result.items, result.counts, store, dir))
    }

    const dirty = result.counts.drifted + result.counts.new + result.counts.orphaned + result.counts.unknown
    if (dirty > 0) {
      if (!flags.json) {
        outputResult(`\nProject not clean: ${formatDirtySummary(result.counts)}. Exiting 1.`)
      }
      process.exitCode = 1
    }
  }
}

function formatDirtySummary(counts: Record<WorkflowStatus, number>): string {
  const parts: string[] = []
  if (counts.drifted > 0) parts.push(`${counts.drifted} drifted`)
  if (counts.new > 0) parts.push(`${counts.new} new`)
  if (counts.orphaned > 0) parts.push(`${counts.orphaned} orphaned`)
  if (counts.unknown > 0) parts.push(`${counts.unknown} unknown`)
  return parts.join(', ')
}

function formatHuman(
  items: StatusItem[],
  counts: Record<WorkflowStatus, number>,
  store: string,
  dir: string,
): string {
  const header = [
    `Store:           ${store}`,
    `Workflows dir:   ${dir}`,
    '',
    `clean:    ${counts.clean}`,
    `drifted:  ${counts.drifted}`,
    `new:      ${counts.new}`,
    `orphaned: ${counts.orphaned}`,
    `unknown:  ${counts.unknown}`,
    '',
  ]

  const rows = items.map((item) => {
    const label = STATUS_LABEL[item.status].padEnd(9)
    const ref = item.filePath ?? `(remote: ${item.workflowId ?? '?'}${item.name ? ` "${item.name}"` : ''})`
    const tail = item.message ? ` — ${item.message}` : ''
    return `${label} ${ref}${tail}`
  })

  return [...header, ...rows].join('\n')
}
