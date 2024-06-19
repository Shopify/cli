import {BaseProcess, DevProcessFunction} from './types.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AdminSession, ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'

interface PreviewThemeAppExtensionsOptions {
  adminSession: AdminSession
  developerPlatformClient: DeveloperPlatformClient
  theme?: string
  themeExtensionPort?: number
}

export interface PreviewThemeAppExtensionsProcess extends BaseProcess<PreviewThemeAppExtensionsOptions> {
  type: 'theme-app-extensions'
}

const runThemeAppExtensionsServerNext: DevProcessFunction<PreviewThemeAppExtensionsOptions> = async (
  {stdout: _stdout, stderr: _stderr, abortSignal: _abortSignal},
  {
    adminSession: _adminSession,
    developerPlatformClient: _developerPlatformClient,
    theme: _theme,
    themeExtensionPort: _themeExtensionPort,
  },
) => {
  outputInfo('This feature is currently in development and is not ready for use or testing yet.')

  await findOrCreateHostTheme()
  await initializeFSWatcher()
  await startThemeAppExtensionDevelopmentServer()
}

export async function setupPreviewThemeAppExtensionsProcess({
  allExtensions,
  storeFqdn,
  theme,
  themeExtensionPort,
  developerPlatformClient,
}: Pick<PreviewThemeAppExtensionsOptions, 'developerPlatformClient'> & {
  allExtensions: ExtensionInstance[]
  storeFqdn: string
  theme?: string
  themeExtensionPort?: number
}): Promise<PreviewThemeAppExtensionsProcess | undefined> {
  outputInfo('This feature is currently in development and is not ready for use or testing yet.')

  const themeExtensions = allExtensions.filter((ext) => ext.isThemeExtension)
  if (themeExtensions.length === 0) {
    return
  }

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  return {
    type: 'theme-app-extensions',
    prefix: 'theme-extensions',
    function: runThemeAppExtensionsServerNext,
    options: {
      adminSession,
      developerPlatformClient,
      theme,
      themeExtensionPort,
    },
  }
}

async function findOrCreateHostTheme() {}

async function initializeFSWatcher() {}

async function startThemeAppExtensionDevelopmentServer() {}
