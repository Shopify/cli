import {BaseProcess, DevProcessFunction} from './types.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {HostThemeManager} from '../../../utilities/host-theme-manager.js'
import {themeExtensionArgs} from '../theme-extension-args.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession, ensureAuthenticatedAdmin, ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'

// Tokens may be invalidated after as little as 4 minutes, better to be safe and refresh every 3 minutes
const PARTNERS_TOKEN_REFRESH_TIMEOUT_IN_MS = 3 * 60 * 1000

interface PreviewThemeAppExtensionsOptions {
  adminSession: AdminSession
  themeExtensionServerArgs: string[]
  storefrontToken: string
  developerPlatformClient: DeveloperPlatformClient
}

export interface PreviewThemeAppExtensionsProcess extends BaseProcess<PreviewThemeAppExtensionsOptions> {
  type: 'theme-app-extensions'
}

export const runThemeAppExtensionsServer: DevProcessFunction<PreviewThemeAppExtensionsOptions> = async (
  {stdout, stderr, abortSignal},
  {adminSession, themeExtensionServerArgs: args, storefrontToken, developerPlatformClient},
) => {
  const refreshSequence = (attempt = 0) => {
    outputDebug(`Refreshing Developer Platform token (attempt ${attempt})...`, stdout)
    refreshToken(developerPlatformClient)
      .then(() => {
        outputDebug('Refreshed Developer Platform token successfully', stdout)
      })
      .catch((error) => {
        outputDebug(`Failed to refresh Developer Platform token: ${error}`, stderr)
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

  await refreshToken(developerPlatformClient)
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
  developerPlatformClient,
}: Pick<PreviewThemeAppExtensionsOptions, 'developerPlatformClient'> & {
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
    themeExtensionArgs(extension, apiKey, developerPlatformClient, {
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
      developerPlatformClient,
    },
  }
}

async function refreshToken(developerPlatformClient: DeveloperPlatformClient) {
  const newToken = await developerPlatformClient.refreshToken()
  if (useEmbeddedThemeCLI()) {
    await execCLI2(['theme', 'token', '--partners', newToken])
  }
}
