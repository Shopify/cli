import {renderSelectPrompt, renderTextPrompt} from './ui.js'
import {ensureAuthenticatedUser} from './session.js'
import {identityFqdn} from './context/fqdn.js'
import * as sessionStore from '../../private/node/session/store.js'
import {setCurrentSessionId} from '../../private/node/conf-store.js'
import type {Sessions} from '../../private/node/session/schema.js'

const NEW_LOGIN_VALUE = 'NEW_LOGIN'

interface SessionChoice {
  label: string
  value: string
  account?: SelectedSession
}

/** Public account details for a selected Shopify identity session. */
export interface SelectedSession {
  /** The identity provider user ID. */
  userId: string
  /** The alias or display label used to select the account. */
  alias: string
  /** The email returned by authentication, or null when it is not stored. */
  email: string | null
}

function emailOrNull(email?: string): string | null {
  return email === '' ? null : (email ?? null)
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
        account: {userId, alias: session.identity.alias ?? userId, email: emailOrNull(session.identity.email)},
      })
    }
  }

  return choices
}

/**
 * Handles the new login flow.
 * If no alias is stored (email couldn't be fetched), prompts the user for a friendly alias.
 *
 * @returns The details of the authenticated user.
 */
async function handleNewLogin(): Promise<SelectedSession> {
  const result = await ensureAuthenticatedUser({}, {forceNewSession: true})
  const account = await sessionStore.getSessionAccount(result.userId)
  const alias = account?.alias

  if (!alias) {
    const userAlias = await renderTextPrompt({
      message: 'Enter an alias for this account (e.g. your email or a nickname)',
    })
    await sessionStore.setSessionAlias(result.userId, userAlias)
    return {userId: result.userId, alias: userAlias, email: emailOrNull(account?.email)}
  }

  return {userId: result.userId, alias, email: emailOrNull(account?.email)}
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
 * @param alias - Optional alias of the account to switch to.
 * @returns Promise with the alias of the chosen session.
 */
export async function promptSessionSelect(alias?: string): Promise<string> {
  return (await promptSessionSelectWithDetails(alias)).alias
}

/**
 * Selects an existing session or authenticates a new account and returns its public details.
 *
 * @param alias - Optional alias or user ID of an account to select.
 * @returns The selected user ID, display alias, and stored email without credentials.
 */
export async function promptSessionSelectWithDetails(alias?: string): Promise<SelectedSession> {
  if (alias) {
    const account = await sessionStore.findSessionAccountByAlias(alias)
    if (account) {
      setCurrentSessionId(account.userId)
      return {userId: account.userId, alias, email: emailOrNull(account.email)}
    }
  }

  const choices = await getAllChoices()
  let selectedValue = NEW_LOGIN_VALUE

  if (choices.length > 0) {
    const message = 'Which account would you like to use?'
    selectedValue = await renderSelectPrompt({
      message,
      choices: choices.map(({label, value}) => ({label, value})),
    })
  }

  if (selectedValue === NEW_LOGIN_VALUE) {
    return handleNewLogin()
  }

  setCurrentSessionId(selectedValue)
  return (
    choices.find((choice) => choice.value === selectedValue)?.account ?? {
      userId: selectedValue,
      alias: selectedValue,
      email: null,
    }
  )
}
