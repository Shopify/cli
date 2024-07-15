import {ensureValidPassword} from '../utilities/prompts.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {REPLThemeManager} from '../utilities/repl-theme-manager.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {AdminSession} from '@shopify/cli-kit/node/session'

export async function ensureReplEnv(adminSession: AdminSession, store: string, storePasswordFlag?: string) {
  const themeId = await findOrCreateReplTheme(adminSession)

  const storePassword = (await isStorefrontPasswordProtected(store))
    ? await ensureValidPassword(storePasswordFlag, store)
    : undefined

  return {
    themeId,
    storePassword,
  }
}

async function findOrCreateReplTheme(adminSession: AdminSession): Promise<string> {
  const themeName = `Liquid Console (${CLI_KIT_VERSION})`
  const themeManager = new REPLThemeManager(adminSession)

  const replTheme = await themeManager.findOrCreate(DEVELOPMENT_THEME_ROLE, themeName)

  return replTheme.id.toString()
}

export async function repl(
  _adminSession: AdminSession,
  _storefrontToken: string,
  _themeId: string,
  _password: string | undefined,
) {}
