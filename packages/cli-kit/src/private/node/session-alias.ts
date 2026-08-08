import {setCommandSessionId} from './session/command-session.js'
import * as sessionStore from './session/store.js'
import {AbortError} from '../../public/node/error.js'
import {outputContent, outputToken} from '../../public/node/output.js'

/**
 * Finds a stored Shopify account session by alias without changing the current session.
 *
 * @param alias - The account alias to find.
 * @returns The matching session ID, or undefined if no session matches.
 */
export async function findSessionIdByAlias(alias: string): Promise<string | undefined> {
  return sessionStore.findSessionByAlias(alias)
}

/**
 * Selects a stored Shopify account session by alias for the current command process.
 *
 * @param alias - The account alias to select. Passing undefined clears the command selection.
 */
export async function setCurrentSessionAlias(alias?: string): Promise<void> {
  if (!alias) {
    setCommandSessionId(undefined)
    return
  }

  const sessionId = await findSessionIdByAlias(alias)
  if (!sessionId) {
    throw new AbortError(
      outputContent`No authenticated account found for alias ${outputToken.yellow(alias)}.`,
      outputContent`Run ${outputToken.genericShellCommand(`shopify auth login`)} first.`,
    )
  }
  setCommandSessionId(sessionId)
}
