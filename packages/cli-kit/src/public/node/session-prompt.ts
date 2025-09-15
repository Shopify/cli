import {renderSelectPrompt} from './ui.js'
import {ensureAuthenticatedUser} from './session.js'
import {identityFqdn} from './context/fqdn.js'
import * as sessionStore from '../../private/node/session/store.js'
import {setCurrentSessionId} from '../../private/node/conf-store.js'
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
 * Handles the new login flow.
 *
 * @param defaultAlias - The default alias to suggest.
 * @returns The alias of the authenticated user.
 */
async function handleNewLogin(defaultAlias?: string): Promise<string> {
  const result = await ensureAuthenticatedUser({}, {forceNewSession: true, alias: defaultAlias})
  const alias = await sessionStore.getSessionAlias(result.userId)
  return alias ?? result.userId
}

/**
 * Gets all available session choices including the "new login" option.
 *
 * @returns Array of session choices.
 */
async function getAllChoices(): Promise<SessionChoice[]> {
  const sessions = await sessionStore.fetch()
  const fqdn = await identityFqdn()
  const choices: SessionChoice[] = []

  if (sessions) {
    choices.push(...buildSessionChoices(sessions, fqdn))
  }

  if (choices.length > 0) {
    choices.push({
      label: 'Log in with a different account',
      value: NEW_LOGIN_VALUE,
    })
  }

  return choices
}

/**
 * Prompts the user to select from existing sessions or log in with a different account.
 *
 * - If alias is provided, tries to switch to that session directly
 * - Otherwise, shows a prompt with all available sessions and the option to log in with a different account.
 *
 * @param alias - Optional alias to switch to or use for the new session if created.
 * @returns Promise with the alias of the chosen session.
 */
export async function promptSessionSelect(alias?: string): Promise<string> {
  if (alias) {
    const userId = await sessionStore.findSessionByAlias(alias)
    if (userId) {
      setCurrentSessionId(userId)
      return alias
    }
  }

  const choices = await getAllChoices()
  let selectedValue = NEW_LOGIN_VALUE

  if (choices.length > 0) {
    selectedValue = await renderSelectPrompt({
      message: 'Which account would you like to use?',
      choices,
    })
  }

  if (selectedValue === NEW_LOGIN_VALUE) {
    return handleNewLogin(alias)
  }

  setCurrentSessionId(selectedValue)
  return choices.find((choice) => choice.value === selectedValue)?.label ?? selectedValue
}
