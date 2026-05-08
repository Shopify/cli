import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {shopifyFetch, type Response} from '@shopify/cli-kit/node/http'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedIdentity} from '@shopify/cli-kit/node/session'

const DEFAULT_FLOW_TOOL_CALL_ENDPOINT = 'https://flow.shopifycloud.com/flow-core/tool_call'
const DEFAULT_LOCAL_FLOW_TOOL_CALL_ENDPOINT = 'https://flow.shop.dev/flow-core/tool_call'
const DEFAULT_SIDEKICK_FLOW_TOOL_CALL_ENDPOINT = 'https://sidekick.shopify.ai/flow/tools/call'
const DEFAULT_LOCAL_SIDEKICK_FLOW_TOOL_CALL_ENDPOINT = 'https://agent-server.shop.dev/flow/tools/call'
const FLOW_WORKFLOWS_MANAGE_SCOPE = 'https://api.shopify.com/auth/flow.workflows.manage'
const SHOP_ADMIN_GRAPHQL_SCOPE = 'https://api.shopify.com/auth/shop.admin.graphql'

const FLOW_OWNED_TOOLS = new Set([
  'flow_app_agent_create_or_update_workflow_from_json',
  'flow_app_agent_environment_paths_search',
  'flow_app_agent_object_type_definition_search',
  'flow_app_agent_shopifyql_query_fields',
  'flow_app_agent_task_configuration',
  'flow_app_agent_task_search',
  'flow_app_agent_template_search',
  'flow_app_agent_workflow_lookup',
])

export interface FlowToolCallInput {
  tool: string
  store: string
  arguments?: string
  argumentsFile?: string
  endpoint?: string
}

async function parseArguments(
  input: Pick<FlowToolCallInput, 'arguments' | 'argumentsFile'>,
): Promise<Record<string, unknown>> {
  let rawArguments: string

  if (input.arguments !== undefined) {
    rawArguments = input.arguments
  } else if (input.argumentsFile) {
    if (!(await fileExists(input.argumentsFile))) {
      throw new AbortError(
        outputContent`Arguments file not found at ${outputToken.path(
          input.argumentsFile,
        )}. Please check the path and try again.`,
      )
    }
    rawArguments = await readFile(input.argumentsFile, {encoding: 'utf8'})
  } else {
    rawArguments = '{}'
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawArguments)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(
      outputContent`Invalid JSON in Flow tool arguments: ${errorMessage}`,
      'Please provide a valid JSON object.',
    )
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new AbortError('Flow tool arguments must be a JSON object.')
  }

  return parsed as Record<string, unknown>
}

function endpointFor(input: FlowToolCallInput): string {
  if (input.endpoint) return input.endpoint
  if (process.env.SHOPIFY_FLOW_TOOL_CALL_ENDPOINT) return process.env.SHOPIFY_FLOW_TOOL_CALL_ENDPOINT

  const local = process.env.SHOPIFY_SERVICE_ENV === 'local'
  if (FLOW_OWNED_TOOLS.has(input.tool)) {
    return local ? DEFAULT_LOCAL_FLOW_TOOL_CALL_ENDPOINT : DEFAULT_FLOW_TOOL_CALL_ENDPOINT
  }

  return local ? DEFAULT_LOCAL_SIDEKICK_FLOW_TOOL_CALL_ENDPOINT : DEFAULT_SIDEKICK_FLOW_TOOL_CALL_ENDPOINT
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text.trim()) return {}

  try {
    return JSON.parse(text)
  } catch {
    return {raw: text}
  }
}

export async function callFlowTool(input: FlowToolCallInput): Promise<unknown> {
  const parsedArguments = await parseArguments(input)
  const flowOwnedTool = FLOW_OWNED_TOOLS.has(input.tool)
  const auth = await ensureAuthenticatedIdentity([flowOwnedTool ? FLOW_WORKFLOWS_MANAGE_SCOPE : SHOP_ADMIN_GRAPHQL_SCOPE])
  const endpoint = endpointFor(input)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
    'X-Shopify-Shop-Domain': input.store,
    'X-Shopify-User-Id': auth.userId,
  }

  const response = await shopifyFetch(
    endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: input.tool,
        arguments: parsedArguments,
      }),
    },
    'slow-request',
  )

  const body = await parseResponse(response)

  if (!response.ok) {
    throw new AbortError(`Flow tool gateway request failed with HTTP ${response.status}.`, JSON.stringify(body, null, 2))
  }

  return body
}
