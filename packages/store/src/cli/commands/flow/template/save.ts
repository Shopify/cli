import {dispatchFlowTool} from '../../../services/flow/dispatch.js'
import {loadConfig, workflowsDirAbsolute} from '../../../services/flow/project-config.js'
import {writeWorkflowFile, type WorkflowJson} from '../../../services/flow/workflow-lifecycle.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

interface TemplateLookupResponseJson {
  template_id?: string
  title?: string
  workflow_json?: WorkflowJson
  error?: string
  error_code?: string
}

export default class FlowTemplateSave extends StoreCommand {
  static summary = 'Save a Flow template into your IaC project as a new workflow.'

  static descriptionWithMarkdown = `Fetches the template by ID (always the leading version) and writes its \`workflow_json\` to \`<workflows-dir>/<slug>/workflow.flow.json\`. Sets \`root.workflow_name\` to the template's title — rename it before push if you want a different name.

No lockfile is written; the file is "new" until you \`push\` it.

Get a template ID from \`shopify flow template search\` — each result carries a stable \`template_id\` field.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> 01HQK000000000000000000000 --as fraud-prevention',
    '<%= config.bin %> <%= command.id %> 01HQK... --as high-value-orders --force',
  ]

  static args = {
    'template-id': Args.string({
      description: 'Template identifier from a prior `flow template search` result.',
      required: true,
    }),
  }

  static flags = {
    ...globalFlags,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain. Falls back to flow.toml.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    as: Flags.string({
      char: 'a',
      description: 'Slug for the new workflow folder. Creates workflows/<slug>/workflow.flow.json.',
      required: true,
    }),
    'workflows-dir': Flags.string({
      description: 'Workflows directory (relative to cwd). Falls back to flow.toml.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOWS_DIR',
    }),
    force: Flags.boolean({
      description: 'Overwrite an existing workflow.flow.json at the target path.',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowTemplateSave)

    const config = await loadConfig()
    const store = flags.store ?? config?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const dir = flags['workflows-dir']
      ? resolvePath(cwd(), flags['workflows-dir'])
      : config
        ? workflowsDirAbsolute(config)
        : undefined
    if (!dir) {
      throw new AbortError(
        'No workflows directory. Pass --workflows-dir, or run `shopify flow init` to create a flow.toml.',
      )
    }

    const targetDir = joinPath(dir, flags.as)
    const filePath = joinPath(targetDir, 'workflow.flow.json')

    if ((await fileExists(filePath)) && !flags.force) {
      throw new AbortError(`${filePath} already exists.`, 'Pass --force to overwrite.')
    }

    const response = await dispatchFlowTool({
      name: 'flow_app_agent_template_lookup',
      source: 'flow',
      store,
      args: {template_id: args['template-id']},
    })

    const json = unwrapJsonResult(response)
    if (json.error) {
      throw new AbortError(`Template lookup failed: ${json.error}`, json.error_code)
    }
    if (!json.workflow_json) {
      throw new AbortError(`Template ${args['template-id']} has no workflow_json.`)
    }

    const payload: WorkflowJson = json.workflow_json
    const root = payload.root as Record<string, unknown> | undefined
    if (root && !root.workflow_name) {
      root.workflow_name = json.title ?? flags.as
    }

    await mkdir(targetDir)
    await writeWorkflowFile(filePath, payload)

    const lines = [
      `Saved "${json.title ?? args['template-id']}" to ${filePath}.`,
      '',
      'Next:',
      `  shopify flow workflow validate ${filePath}`,
      `  shopify flow workflow push     ${filePath}     # creates lockfile`,
    ]
    outputResult(lines.join('\n'))
  }
}

function unwrapJsonResult(response: unknown): TemplateLookupResponseJson {
  const typed = response as {ok: boolean; data?: TemplateLookupResponseJson} | undefined
  if (!typed?.data) throw new AbortError('Unexpected response shape from template_lookup.')
  return typed.data
}
