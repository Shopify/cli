import {loadConfig} from '../../services/flow/project-config.js'
import {readWorkflowFile} from '../../services/flow/workflow-lifecycle.js'
import {authenticateFlowStore, throwFlowAuthExpired} from '../../services/flow/auth.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

const FLOW_PREVIEW_URL_PRODUCTION = 'https://flow.shopifycloud.com/flow-core/mcp_preview/transform'
const FLOW_PREVIEW_URL_LOCAL = 'https://flow.shop.dev/flow-core/mcp_preview/transform'

function previewEndpoint(): string {
  return process.env.SHOPIFY_SERVICE_ENV === 'local' ? FLOW_PREVIEW_URL_LOCAL : FLOW_PREVIEW_URL_PRODUCTION
}

export default class FlowWorkflowPreview extends Command {
  static summary = 'Transform a local workflow JSON file into the preview payload used by the MCP preview iframe.'

  static descriptionWithMarkdown = `Reads a local \`.flow.json\` file, calls the Flow MCP preview transform endpoint, and prints the resulting JSON. The output is the payload the \`/public/mcp-preview\` iframe expects via \`postMessage({type: "mcp-workflow-preview", workflow: <result>})\`.

This is the data path used by the Flow VSCode extension. The extension shells out to this command transparently when the user opens or saves a \`.flow.json\` file — no manual invocation required.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %> ./workflow.flow.json --store shop.myshopify.com']

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
    const {args, flags} = await this.parse(FlowWorkflowPreview)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `flow init` to create a flow.toml.')
    }

    const payload = await readWorkflowFile(args.file)
    const session = await authenticateFlowStore(store)

    const response = await shopifyFetch(
      previewEndpoint(),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': store,
        },
        body: JSON.stringify(payload),
      },
      'slow-request',
    )

    if (response.status === 401) throwFlowAuthExpired(session)

    const text = await response.text()
    if (!response.ok) {
      throw new AbortError(`Preview transform failed (HTTP ${response.status}).`, text)
    }

    outputResult(text)
  }
}
