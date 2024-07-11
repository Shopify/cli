import {
  isStorefrontPasswordProtected,
  promptPassword,
  isStorefrontPasswordCorrect,
} from '../utilities/theme-environment/storefront-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'

export async function ensureReplEnv(store: string, password?: string) {
  const themeId = await findOrCreateReplTheme()

  const finalPassword = (await isStorefrontPasswordProtected(store))
    ? await promptValidPassword(password, store)
    : password

  return {
    themeId,
    password: finalPassword,
  }
}

async function promptValidPassword(password: string | undefined, store: string) {
  let finalPassword = password || (await promptPassword('Enter your theme password: '))

  // eslint-disable-next-line no-await-in-loop
  while (!(await isStorefrontPasswordCorrect(finalPassword, store))) {
    // eslint-disable-next-line no-await-in-loop
    finalPassword = await promptPassword('Incorrect password provided. Please try again: ')
  }
  return finalPassword
}

async function findOrCreateReplTheme(): Promise<string> {
  return ''
}

export async function repl(
  _adminSession: AdminSession,
  _storefrontToken: string,
  _themeId: string,
  _password: string | undefined,
) {}
