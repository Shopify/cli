import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {REPLThemeManager} from '../utilities/repl/repl-theme-manager.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {replLoop} from '../utilities/repl/repl.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function ensureReplEnv(adminSession: AdminSession, storePasswordFlag?: string) {
  const themeId = await findOrCreateReplTheme(adminSession)

  const storePassword = (await isStorefrontPasswordProtected(adminSession))
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
  outputInfo('Welcome to Shopify Liquid console\n(press Ctrl + C to exit)')

  if (themeAccessPassword?.startsWith('shpat_')) {
    throw new AbortError(
      'Unable to use Admin API tokens with the console command',
      `To use this command with the --password flag you must:

1. Install the Theme Access app on your shop
2. Generate a new password

Alternatively, you can authenticate normally by not passing the --password flag.

Learn more: https://shopify.dev/docs/storefronts/themes/tools/theme-access`,
    )
  }

  const session = await initializeDevServerSession(themeId, adminSession, themeAccessPassword, storefrontPassword)

  return replLoop(session, themeId, url)
}
