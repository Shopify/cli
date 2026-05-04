import {randomUUID} from './crypto.js'
import {AbortError} from './error.js'
import {fileExists, mkTmpDir, readFile, removeFile, writeFile} from './fs.js'
import {outputContent, outputDebug, outputToken} from './output.js'
import {joinPath} from './path.js'

export const SHOPIFY_CLI_AGENT_CONTEXT = 'SHOPIFY_CLI_AGENT_CONTEXT'
export const SHOPIFY_CLI_AGENT = 'SHOPIFY_CLI_AGENT'
export const SHOPIFY_CLI_AGENT_VERSION = 'SHOPIFY_CLI_AGENT_VERSION'
export const SHOPIFY_CLI_AGENT_PROVIDER = 'SHOPIFY_CLI_AGENT_PROVIDER'
export const SHOPIFY_CLI_AGENT_MODEL = 'SHOPIFY_CLI_AGENT_MODEL'
export const SHOPIFY_CLI_AGENT_HARNESS = 'SHOPIFY_CLI_AGENT_HARNESS'
export const SHOPIFY_CLI_AGENT_RUN_ID = 'SHOPIFY_CLI_AGENT_RUN_ID'
export const SHOPIFY_CLI_AGENT_SESSION_ID = 'SHOPIFY_CLI_AGENT_SESSION_ID'

const AGENT_CONVERSATION_FILENAME = 'shopify-agent-conversation.json'
const START_AGENT_CONVERSATION_COMMAND = 'shopify agent conversation start --json'

export interface AgentConversationContext {
  conversationId: string
  agent?: string
  agentVersion?: string
  provider?: string
  harness?: string
  model?: string
  startedAt: string
}

export interface AgentConversationHandle extends AgentConversationContext {
  contextPath: string
}

export interface StartAgentConversationInput {
  conversationId?: string
  agent?: string
  agentVersion?: string
  provider?: string
  harness?: string
  model?: string
  startedAt?: string
}

export function generateConversationId(): string {
  return `conv_${randomUUID()}`
}

export function createAgentConversationContext(input: StartAgentConversationInput = {}): AgentConversationContext {
  return {
    conversationId: input.conversationId ?? generateConversationId(),
    agent: input.agent,
    agentVersion: input.agentVersion,
    provider: input.provider,
    harness: input.harness,
    model: input.model,
    startedAt: input.startedAt ?? new Date().toISOString(),
  }
}

export async function startAgentConversation(input: StartAgentConversationInput = {}): Promise<AgentConversationHandle> {
  const context = createAgentConversationContext(input)
  const contextDirectory = await mkTmpDir()
  const contextPath = joinPath(contextDirectory, AGENT_CONVERSATION_FILENAME)
  await writeFile(contextPath, JSON.stringify(context, null, 2))
  return {...context, contextPath}
}

export async function inspectAgentConversation(options: {
  contextPath?: string
  env?: NodeJS.ProcessEnv
} = {}): Promise<AgentConversationHandle> {
  const contextPath = options.contextPath ?? options.env?.[SHOPIFY_CLI_AGENT_CONTEXT]
  if (!contextPath) throw noActiveAgentConversationError()

  if (!(await fileExists(contextPath))) {
    throw new AbortError(
      `Shopify agent conversation context was not found at ${contextPath}.`,
      `Start a new one with ${START_AGENT_CONVERSATION_COMMAND}.`,
    )
  }

  const parsed = parseAgentConversationContext(await readFile(contextPath))
  return {...parsed, contextPath}
}

export async function endAgentConversation(options: {
  contextPath?: string
  env?: NodeJS.ProcessEnv
} = {}): Promise<AgentConversationHandle> {
  const conversation = await inspectAgentConversation(options)
  await removeFile(conversation.contextPath)
  return conversation
}

export function agentConversationEnvironmentVariables(
  conversation: AgentConversationContext,
  contextPath: string,
): Record<string, string> {
  return {
    [SHOPIFY_CLI_AGENT_CONTEXT]: contextPath,
    [SHOPIFY_CLI_AGENT_SESSION_ID]: conversation.conversationId,
    ...(conversation.agent ? {[SHOPIFY_CLI_AGENT]: conversation.agent} : {}),
    ...(conversation.agentVersion ? {[SHOPIFY_CLI_AGENT_VERSION]: conversation.agentVersion} : {}),
    ...(conversation.provider ? {[SHOPIFY_CLI_AGENT_PROVIDER]: conversation.provider} : {}),
    ...(conversation.model ? {[SHOPIFY_CLI_AGENT_MODEL]: conversation.model} : {}),
    ...(conversation.harness ? {[SHOPIFY_CLI_AGENT_HARNESS]: conversation.harness} : {}),
  }
}

export async function resolveShopifyAgentEnvironmentVariables(
  env: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, string>> {
  const explicitShopifyVariables = Object.fromEntries(
    Object.entries(env).filter(([key, value]) => key.startsWith('SHOPIFY_') && typeof value === 'string'),
  ) as Record<string, string>

  const contextPath = explicitShopifyVariables[SHOPIFY_CLI_AGENT_CONTEXT]
  if (!contextPath) return explicitShopifyVariables

  try {
    const conversation = await inspectAgentConversation({contextPath})
    return {...agentConversationEnvironmentVariables(conversation, contextPath), ...explicitShopifyVariables}
  } catch (error) {
    outputDebug(
      outputContent`Failed to load Shopify agent conversation context from ${outputToken.path(contextPath)}: ${outputToken.raw(
        error instanceof Error ? error.message : String(error),
      )}`,
    )
    return explicitShopifyVariables
  }
}

function noActiveAgentConversationError(): AbortError {
  return new AbortError(
    'No active Shopify agent conversation was found.',
    `Start one with ${START_AGENT_CONVERSATION_COMMAND}.`,
  )
}

function parseAgentConversationContext(content: string): AgentConversationContext {
  const parsed = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Shopify agent conversation context must be a JSON object.')
  }

  const conversationId = requiredString(parsed, 'conversationId')
  const startedAt = requiredString(parsed, 'startedAt')

  return {
    conversationId,
    startedAt,
    agent: optionalString(parsed, 'agent'),
    agentVersion: optionalString(parsed, 'agentVersion'),
    provider: optionalString(parsed, 'provider'),
    harness: optionalString(parsed, 'harness'),
    model: optionalString(parsed, 'model'),
  }
}

function requiredString(object: object, key: string): string {
  const value = Reflect.get(object, key)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Shopify agent conversation context is missing ${key}.`)
  }
  return value
}

function optionalString(object: object, key: string): string | undefined {
  const value = Reflect.get(object, key)
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Shopify agent conversation context has an invalid ${key}.`)
  }
  return value
}
