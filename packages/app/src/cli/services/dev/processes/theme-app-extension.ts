import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedAdmin, ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {HostThemeManager} from '../../../utilities/host-theme-manager.js'
import {themeExtensionArgs} from '../theme-extension-args.js'
import {runThemeAppExtensionServer} from './theme-app-extension-dev-preview.js'
import type {DevProcessFunction, PreviewThemeAppExtensionsOptions, PreviewThemeAppExtensionsProcess} from './types.js'

export const runLegacyThemeAppExtensionsServer: DevProcessFunction<PreviewThemeAppExtensionsOptions> = async (
  {stdout, stderr, abortSignal},
  {adminSession, themeExtensionServerArgs: args, storefrontToken, token},
) => {
  await execCLI2(['extension', 'serve', ...args], {
    store: adminSession.storeFqdn,
    adminToken: adminSession.token,
    storefrontToken,
    token,
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
  devPreview,
}: Pick<PreviewThemeAppExtensionsOptions, 'token'> & {
  allExtensions: ExtensionInstance[]
  apiKey: string
  storeFqdn: string
  theme?: string
  notify?: string
  themeExtensionPort?: number
  devPreview: boolean
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

  const taeFunc = devPreview ? runThemeAppExtensionServer : runLegacyThemeAppExtensionsServer

  return {
    type: 'theme-app-extensions',
    prefix: 'extensions',
    function: taeFunc,
    options: {
      adminSession,
      themeExtensionServerArgs: args,
      storefrontToken,
      token,
    },
  }
}
