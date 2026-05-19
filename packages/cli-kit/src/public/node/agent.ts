import {LocalStorage} from './local-storage.js'
import {
  getAgentSession,
  setAgentSession,
  removeAgentSession,
  AgentSession,
  ConfSchema,
} from '../../private/node/conf-store.js'

export type {AgentSession}

export interface StartAgentSessionOptions {
  sessionId: string
  agentName: string
  agentVersion: string
  agentProvider: string
  metricsMode?: 'on' | 'off'
  defaultNonInteractive?: boolean
}

/**
 * Start a new agent session.
 *
 * Persists the agent session state to the CLI kit config store.
 *
 * @param options - Agent session configuration.
 * @param config - Optional config store for testing.
 * @returns The persisted session value.
 */
export function startAgentSession(
  options: StartAgentSessionOptions,
  config?: LocalStorage<ConfSchema>,
): AgentSession {
  const session: AgentSession = {
    sessionId: options.sessionId,
    startedAt: new Date().toISOString(),
    agentName: options.agentName,
    agentVersion: options.agentVersion,
    agentProvider: options.agentProvider,
    metricsMode: options.metricsMode ?? 'on',
    defaultNonInteractive: options.defaultNonInteractive ?? false,
  }
  setAgentSession(session, config)
  return session
}

/**
 * Get the current agent session.
 *
 * @param config - Optional config store for testing.
 * @returns Current agent session, or undefined if no session is active.
 */
export function getCurrentAgentSession(config?: LocalStorage<ConfSchema>): AgentSession | undefined {
  return getAgentSession(config)
}

/**
 * Clear the current agent session.
 *
 * Removes the persisted agent session state from the CLI kit config store.
 *
 * @param config - Optional config store for testing.
 */
export function clearAgentSession(config?: LocalStorage<ConfSchema>): void {
  removeAgentSession(config)
}

/**
 * Pack SHOPIFY_CLI_AGENT_INFO environment variable value from agent session.
 *
 * The format is a tagged string with agent metadata:
 * n:<name>|v:<version>|p:<provider>
 *
 * Precedence: explicit process.env.SHOPIFY_CLI_AGENT_INFO takes priority over
 * persisted session state.
 *
 * @param session - Optional session to pack from. If not provided, uses current session.
 * @param config - Optional config store for testing.
 * @returns Tagged string for SHOPIFY_CLI_AGENT_INFO, or undefined if no data available.
 */
export function packAgentInfo(session?: AgentSession, config?: LocalStorage<ConfSchema>): string | undefined {
  // Explicit env var wins
  if (process.env.SHOPIFY_CLI_AGENT_INFO) {
    return process.env.SHOPIFY_CLI_AGENT_INFO
  }

  const activeSession = session ?? getCurrentAgentSession(config)
  if (!activeSession) {
    return undefined
  }

  return `n:${activeSession.agentName}|v:${activeSession.agentVersion}|p:${activeSession.agentProvider}`
}

/**
 * Pack SHOPIFY_CLI_AGENT_IDS environment variable value from agent session.
 *
 * The format is a tagged string with session identifier:
 * s:<sessionId>
 *
 * Precedence: explicit process.env.SHOPIFY_CLI_AGENT_IDS takes priority over
 * persisted session state.
 *
 * @param session - Optional session to pack from. If not provided, uses current session.
 * @param config - Optional config store for testing.
 * @returns Tagged string for SHOPIFY_CLI_AGENT_IDS, or undefined if no data available.
 */
export function packAgentIds(session?: AgentSession, config?: LocalStorage<ConfSchema>): string | undefined {
  // Explicit env var wins
  if (process.env.SHOPIFY_CLI_AGENT_IDS) {
    return process.env.SHOPIFY_CLI_AGENT_IDS
  }

  const activeSession = session ?? getCurrentAgentSession(config)
  if (!activeSession) {
    return undefined
  }

  return `s:${activeSession.sessionId}`
}
