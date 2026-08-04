/**
 * The session selected for the current command process via `--auth-alias`.
 *
 * This lives in its own dependency-free module so that resetting it (the overwhelmingly common
 * case, where no alias was passed) does not require loading the session/identity/API graph.
 */
let commandSessionId: string | undefined

/**
 * Get the session id selected for the current command, if any.
 *
 * @returns The selected session id, or undefined when no alias was selected.
 */
export function getCommandSessionId(): string | undefined {
  return commandSessionId
}

/**
 * Select a stored session for the current command process.
 *
 * @param sessionId - The session id to select, or undefined to clear the selection.
 */
export function setCommandSessionId(sessionId: string | undefined): void {
  commandSessionId = sessionId
}
