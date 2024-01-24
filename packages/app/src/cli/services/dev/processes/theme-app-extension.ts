import {BaseProcess, DevProcessFunction} from './types.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {HostThemeManager} from '../../../utilities/host-theme-manager.js'
import {themeExtensionArgs} from '../theme-extension-args.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession, ensureAuthenticatedAdmin, ensureAuthenticatedPartners, ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'

// Tokens are valid for 120 min, better to be safe and refresh every 110 min
const THEME_REFRESH_TIMEOUT_IN_MS = 110 * 60 * 1000

export interface PreviewThemeAppExtensionsOptions {
  adminSession: AdminSession
  themeExtensionServerArgs: string[]
  storefrontToken: string
  token: string
}

export interface PreviewThemeAppExtensionsProcess extends BaseProcess<PreviewThemeAppExtensionsOptions> {
  type: 'theme-app-extensions'
}

export const runThemeAppExtensionsServer: DevProcessFunction<PreviewThemeAppExtensionsOptions> = async (
  {stdout, stderr, abortSignal},
  {adminSession, themeExtensionServerArgs: args, storefrontToken},
) => {
  setInterval(() => {
    outputDebug('Refreshing theme session token...', stdout)
    refreshToken()
      .then(() => {
        outputDebug('Refreshed theme session token successfully', stdout)
      })
      .catch((error) => {
        throw error
      })
  }, THEME_REFRESH_TIMEOUT_IN_MS)

  await refreshToken()
  await execCLI2(['extension', 'serve', ...args], {
    store: adminSession.storeFqdn,
    adminToken: adminSession.token,
    storefrontToken,
    stdout,
    stderr,
    signal: abortSignal,
  })
}

export async function setupPreviewThemeAppExtensionsProcess({
  allExtensions,
  apiKey,
  storeFqdn,
  theme,
  themeExtensionPort,
  notify,
  token,
}: Pick<PreviewThemeAppExtensionsOptions, 'token'> & {
  allExtensions: ExtensionInstance[]
  apiKey: string
  storeFqdn: string
  theme?: string
  notify?: string
  themeExtensionPort?: number
}): Promise<PreviewThemeAppExtensionsProcess | undefined> {
  const themeExtensions = allExtensions.filter((ext) => ext.isThemeExtension)
  if (themeExtensions.length === 0) {
    return
  }

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)
  const extension = themeExtensions[0]!
  let optionsToOverwrite = {}
  if (!theme) {
    const theme = await new HostThemeManager(adminSession).findOrCreate()
    optionsToOverwrite = {
      theme: theme.id.toString(),
      generateTmpTheme: true,
    }
  }
  const [storefrontToken, args] = await Promise.all([
    ensureAuthenticatedStorefront(),
    themeExtensionArgs(extension, apiKey, token, {
      theme,
      themeExtensionPort,
      notify,
      ...optionsToOverwrite,
    }),
  ])

  return {
    type: 'theme-app-extensions',
    prefix: 'extensions',
    function: runThemeAppExtensionsServer,
    options: {
      adminSession,
      themeExtensionServerArgs: args,
      storefrontToken,
      token,
    },
  }
}

async function refreshToken() {
  const newToken = await ensureAuthenticatedPartners([], process.env, {noPrompt: true})
  if (useEmbeddedThemeCLI()) {
    await execCLI2(['theme', 'token', '--partners', newToken])
  }
}
