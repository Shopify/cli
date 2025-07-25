import {renderSelectPrompt} from './ui.js'
import {ensureAuthenticatedUser} from './session.js'
import {identityFqdn} from './context/fqdn.js'
import {setCurrentSessionId} from '../../private/node/conf-store.js'
import * as sessionStore from '../../private/node/session/store.js'
import type {Sessions} from '../../private/node/session/schema.js'

const NEW_LOGIN_VALUE = 'NEW_LOGIN'

interface SessionChoice {
  label: string
  value: string
}

/**
 * Builds the choices array from existing sessions.
 *
 * @param sessions - The sessions object from storage.
 * @param fqdn - The identity provider FQDN.
 * @returns Array of session choices.
 */
function buildSessionChoices(sessions: Sessions, fqdn: string): SessionChoice[] {
  const choices: SessionChoice[] = []
  const fqdnSessions = sessions[fqdn]

  if (fqdnSessions) {
    for (const [userId, session] of Object.entries(fqdnSessions)) {
      choices.push({
        label: session.identity.alias ?? userId,
        value: userId,
      })
    }
  }

  return choices
}

/**
 * Prompts the user to select from existing sessions or log in with a different account.
 *
 * This function:
 * 1. Fetches existing sessions from storage using `store.fetch()`
 * 2. Shows a prompt with all available sessions by their display labels
 * 3. Includes an option to "Log in with a different account"
 * 4. If an existing session is chosen, calls `setCurrentSessionId(userId)`
 * 5. If new login is chosen, calls `ensureAuthenticatedUser()`.
 *
 * @param alias - Optional alias to use for the new session if created.
 * @example
 * ```typescript
 * import {promptSessionSelect} from '@shopify/cli-kit/node/session-prompt'
 *
 * const result = await promptSessionSelect()
 * console.log(`Using session for user: ${result.userId}`)
 * ```
 *
 * @returns Promise that resolves with the user ID of the selected or newly created session.
 */
export async function promptSessionSelect(alias?: string): Promise<{userId: string}> {
  const sessions = await sessionStore.fetch()
  const fqdn = await identityFqdn()

  const choices: SessionChoice[] = []

  // Add existing sessions if any
  if (sessions) {
    const sessionChoices = buildSessionChoices(sessions, fqdn)
    choices.push(...sessionChoices)
  }

  let selectedValue = NEW_LOGIN_VALUE

  if (choices.length > 0) {
    choices.push({
      label: 'Log in with a different account',
      value: NEW_LOGIN_VALUE,
    })

    selectedValue = await renderSelectPrompt({
      message: 'Which account would you like to use?',
      choices,
    })
  }

  if (selectedValue === NEW_LOGIN_VALUE) {
    const result = await ensureAuthenticatedUser({}, {forceNewSession: true, alias})
    return result
  } else {
    setCurrentSessionId(selectedValue)
    if (alias) {
      await sessionStore.updateSessionAlias(selectedValue, alias)
    }
    return {userId: selectedValue}
  }
}
