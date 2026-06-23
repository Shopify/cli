import {loadConfig, workflowsDirAbsolute} from '../../../services/flow/project-config.js'
import {pullAllWorkflows, pullWorkflow} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

export default class FlowWorkflowPull extends StoreCommand {
  static hidden = true

  static summary = 'Pull a Flow workflow definition (or all of them) into local files with lockfiles.'

  static descriptionWithMarkdown = `Without \`--all\`: fetches a single workflow + leading definition from the shop and writes it to \`--out\` (normalized JSON). Sibling \`.flow.lock.json\` is also written.

With \`--all\`: lists every workflow on the shop and writes one file per workflow into the project's workflows directory. Skips files that already exist unless \`--force\` is set. Requires \`flow.toml\` (run \`shopify flow init\` first), or pass \`--workflows-dir\`.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --workflow-id 01HQK... --out ./workflow.flow.json --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --all',
    '<%= config.bin %> <%= command.id %> --all --include-hidden --force',
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
    'workflow-id': Flags.string({
      description: 'ID of a single workflow to pull. Mutually exclusive with --all.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_ID',
      exclusive: ['all'],
    }),
    'workflow-version': Flags.string({
      description: 'Optional definition version when pulling a single workflow. Defaults to leading.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_VERSION',
    }),
    out: Flags.string({
      description: 'Path to write a single workflow JSON. Required without --all.',
      env: 'SHOPIFY_FLAG_FLOW_OUT',
      parse: async (input) => resolvePath(input),
    }),
    all: Flags.boolean({
      description: 'Pull every workflow on the shop into the project workflows directory.',
      default: false,
      exclusive: ['workflow-id'],
    }),
    'workflows-dir': Flags.string({
      description: 'Directory to write workflows into when using --all. Falls back to flow.toml.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOWS_DIR',
    }),
    'include-hidden': Flags.boolean({
      description: 'Include hidden workflows when pulling --all.',
      default: false,
    }),
    force: Flags.boolean({
      description: 'Overwrite existing files when pulling --all. (Single-pull always overwrites the --out path.)',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(FlowWorkflowPull)

    if (flags.all) {
      await this.runPullAll(flags)
      return
    }

    if (!flags['workflow-id'] || !flags.out) {
      throw new AbortError(
        'Pull a single workflow with --workflow-id and --out, or pull every workflow with --all.',
      )
    }

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError(
        'No store. Pass --store, or run `shopify flow init` to write a flow.toml.',
      )
    }

    const result = await pullWorkflow({
      workflowId: flags['workflow-id'],
      workflowVersion: flags['workflow-version'],
      outPath: flags.out,
      store,
    })

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
    } else {
      outputResult(`Pulled workflow ${result.workflowId} (version ${result.workflowDefinitionVersion}) to ${flags.out}.`)
    }
  }

  private async runPullAll(flags: {
    store?: string
    'workflows-dir'?: string
    'include-hidden': boolean
    force: boolean
    json?: boolean
  }): Promise<void> {
    const config = await loadConfig()
    const store = flags.store ?? config?.store
    if (!store) {
      throw new AbortError(
        '--all requires a store. Pass --store or run `shopify flow init` to create a flow.toml.',
      )
    }

    const dir = flags['workflows-dir']
      ? resolvePath(cwd(), flags['workflows-dir'])
      : config
        ? workflowsDirAbsolute(config)
        : undefined
    if (!dir) {
      throw new AbortError(
        '--all requires a workflows directory. Pass --workflows-dir or run `shopify flow init`.',
      )
    }

    const result = await pullAllWorkflows({
      store,
      outDir: dir,
      includeHidden: flags['include-hidden'],
      force: flags.force,
    })

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
      return
    }

    const lines = [
      `Pulled ${result.pulled} of ${result.total} workflow(s) into ${dir}.`,
      result.skipped > 0 ? `Skipped ${result.skipped} (file already exists; pass --force to overwrite).` : '',
      '',
      ...result.items.map((item) =>
        item.status === 'pulled'
          ? `  + ${item.filePath} (${item.workflowId})`
          : `  - ${item.filePath} (${item.workflowId}) — ${item.reason ?? 'skipped'}`,
      ),
    ].filter(Boolean)
    outputResult(lines.join('\n'))
  }
}
