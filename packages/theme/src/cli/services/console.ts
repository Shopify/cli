import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {promptPassword} from '../utilities/theme-environment/theme-password.js'
import {AdminSession} from '@shopify/cli-kit/node/session'

export async function ensureReplEnv(store: string, password?: string) {
  const themeId = await findOrCreateReplTheme()

  const finalPassword = (await shouldPromptForPassword(password, store)) ? await promptPassword() : password

  return {
    themeId,
    password: finalPassword,
  }
}

async function findOrCreateReplTheme(): Promise<string> {
  return ''
}

async function shouldPromptForPassword(password: string | undefined, store: string) {
  if (password) {
    return false
  } else {
    return isStorefrontPasswordProtected(store)
  }
}

export async function repl(
  _adminSession: AdminSession,
  _storefrontToken: string,
  _themeId: string,
  _password: string | undefined,
) {}
