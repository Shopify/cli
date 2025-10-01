import {ClientName} from '../developer-platform-client.js'
import {Session} from '@shopify/cli-kit/node/session'

interface GlobalSessionStore {
  [ClientName.AppManagement]?: Session
  [ClientName.Partners]?: Session
}

// Global in-memory session store shared across all client instances
const globalSessionStore: GlobalSessionStore = {}

/**
 * Get a session from the global store
 */
export function getGlobalSession(clientName: ClientName): Session | undefined {
  return globalSessionStore[clientName]
}

/**
 * Set a session in the global store
 */
export function setGlobalSession(clientName: ClientName, session: Session): void {
  globalSessionStore[clientName] = session
}

/**
 * Clear all sessions from the global store (useful for testing)
 */
export function clearAllGlobalSessions(): void {
  globalSessionStore[ClientName.AppManagement] = undefined
  globalSessionStore[ClientName.Partners] = undefined
}
