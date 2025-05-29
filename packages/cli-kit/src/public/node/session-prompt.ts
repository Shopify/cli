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
 * Gets a display label for a session based on the userId.
 *
 * @param userId - The user ID for the session.
 * @returns A human-readable label for the session.
 */
function getSessionDisplayLabel(userId: string): string {
  // For now, just use the userId as the display label
  // This can be enhanced later to show email/org name when available
  return `Session: ${userId}`
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
    for (const userId of Object.keys(fqdnSessions)) {
      const displayLabel = getSessionDisplayLabel(userId)
      choices.push({
        label: displayLabel,
        value: userId,
      })
    }
  }

  return choices
}

/**
 * Prompts the user to select from existing sessions or log in with a new account.
 *
 * This function:
 * 1. Fetches existing sessions from storage using `store.fetch()`
 * 2. Shows a prompt with all available sessions by their display labels
 * 3. Includes an option to "Log in with a new account"
 * 4. If an existing session is chosen, calls `setCurrentSessionId(userId)`
 * 5. If new login is chosen, calls `ensureAuthenticatedUser()`.
 *
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
export async function promptSessionSelect(): Promise<{userId: string}> {
  const sessions = await sessionStore.fetch()
  const fqdn = await identityFqdn()

  const choices: SessionChoice[] = []

  // Add existing sessions if any
  if (sessions) {
    const sessionChoices = buildSessionChoices(sessions, fqdn)
    choices.push(...sessionChoices)
  }

  // Always add option to log in with new account
  choices.push({
    label: 'Log in with a new account',
    value: NEW_LOGIN_VALUE,
  })

  const selectedValue = await renderSelectPrompt({
    message: 'Which account would you like to use?',
    choices,
  })

  if (selectedValue === NEW_LOGIN_VALUE) {
    const result = await ensureAuthenticatedUser({}, {forceNewSession: true})
    return result
  } else {
    setCurrentSessionId(selectedValue)
    return {userId: selectedValue}
  }
}
