import {ensureValidPassword} from '../utilities/prompts.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'

export async function ensureReplEnv(store: string, storePasswordFlag?: string) {
  const themeId = await findOrCreateReplTheme()

  const storePassword = (await isStorefrontPasswordProtected(store))
    ? await ensureValidPassword(storePasswordFlag, store)
    : undefined

  return {
    themeId,
    storePassword,
  }
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
