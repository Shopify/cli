import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {REPLThemeManager} from '../utilities/repl/repl-theme-manager.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {replLoop} from '../utilities/repl/repl.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {consoleLog} from '@shopify/cli-kit/node/output'

export async function ensureReplEnv(adminSession: AdminSession, storePasswordFlag?: string) {
  const themeId = await findOrCreateReplTheme(adminSession)

  const storePassword = (await isStorefrontPasswordProtected(adminSession.storeFqdn))
    ? await ensureValidPassword(storePasswordFlag, adminSession.storeFqdn)
    : undefined

  return {
    themeId,
    storePassword,
  }
}

async function findOrCreateReplTheme(adminSession: AdminSession): Promise<string> {
  const themeManager = new REPLThemeManager(adminSession)
  const replTheme = await themeManager.findOrCreate()

  return replTheme.id.toString()
}

export async function initializeRepl(
  adminSession: AdminSession,
  themeId: string,
  url: string,
  themeAccessPassword?: string,
  storefrontPassword?: string,
) {
  consoleLog('Welcome to Shopify Liquid console\n(press Ctrl + C to exit)')

  const session = await initializeDevServerSession(themeId, adminSession, themeAccessPassword, storefrontPassword)

  return replLoop(session, themeId, url)
}
