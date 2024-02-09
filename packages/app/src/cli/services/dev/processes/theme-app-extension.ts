import {BaseProcess, DevProcessFunction} from './types.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {HostThemeManager} from '../../../utilities/host-theme-manager.js'
import {themeExtensionArgs} from '../theme-extension-args.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {
  AdminSession,
  ensureAuthenticatedAdmin,
  ensureAuthenticatedPartners,
  ensureAuthenticatedStorefront,
} from '@shopify/cli-kit/node/session'

// Tokens may be invalidated after as little as 4 minutes, better to be safe and refresh every 3 minutes
const PARTNERS_TOKEN_REFRESH_TIMEOUT_IN_MS = 3 * 60 * 1000

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
  const refreshSequence = (attempt = 0) => {
    outputDebug(`Refreshing partners token (attempt ${attempt})...`, stdout)
    refreshToken()
      .then(() => {
        outputDebug('Refreshed partners token successfully', stdout)
      })
      .catch((error) => {
        outputDebug(`Failed to refresh partners token: ${error}`, stderr)
        if (attempt < 3) {
          // Retry after 30 seconds. Sometimes we see random ECONNREFUSED errors
          // so let's let the network sort itself out and retry.
          setTimeout(() => refreshSequence(attempt + 1), 30 * 1000)
        } else {
          throw error
        }
      })
  }
  setInterval(refreshSequence, PARTNERS_TOKEN_REFRESH_TIMEOUT_IN_MS)

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
