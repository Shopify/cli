import {BaseProcess} from './types.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {HostThemeManager} from '../../../utilities/extensions/theme/host-theme-manager.js'
import {AppInterface} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession, ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {fetchTheme} from '@shopify/cli-kit/node/themes/api'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderInfo, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {initializeDevelopmentExtensionServer, ensureValidPassword, isStorefrontPasswordProtected} from '@shopify/theme'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'

interface ThemeAppExtensionServerOptions {
  developerPlatformClient: DeveloperPlatformClient
}

interface HostThemeSetupOptions {
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'>
  localApp: AppInterface
  storeFqdn: string
  theme?: string
  themeExtensionPort?: number
  developerPlatformClient: DeveloperPlatformClient
}

export interface PreviewThemeAppExtensionsProcess extends BaseProcess<ThemeAppExtensionServerOptions> {
  type: 'theme-app-extensions'
}

export async function setupPreviewThemeAppExtensionsProcess(
  options: HostThemeSetupOptions,
): Promise<PreviewThemeAppExtensionsProcess | undefined> {
  const {remoteApp, localApp} = options
  const allExtensions = localApp.allExtensions
  const themeExtensions = allExtensions.filter((ext) => ext.isThemeExtension)
  if (themeExtensions.length === 0) {
    return
  }

  const themeExtension = themeExtensions[0]!
  const themeExtensionDirectory = themeExtension.directory
  const themeExtensionPort = options.themeExtensionPort ?? 9293

  const [adminSession, appUrl] = await Promise.all([
    ensureAuthenticatedAdmin(options.storeFqdn),
    buildAppUrl(remoteApp),
  ])

  const storeFqdn = adminSession.storeFqdn
  const storefrontPassword = (await isStorefrontPasswordProtected(storeFqdn))
    ? await ensureValidPassword('', storeFqdn)
    : undefined

  const theme = await findOrCreateHostTheme(adminSession, options.theme)
  const themeId = theme.id.toString()

  renderInfo({
    headline: 'The theme app extension development server is ready.',
    orderedNextSteps: true,
    nextSteps: [
      [
        {
          link: {
            label: 'Install your app in your development store',
            url: appUrl,
          },
        },
      ],
      [
        {
          link: {
            label: 'Setup your theme app extension in the host theme',
            url: `https://${storeFqdn}/admin/themes/${themeId}/editor`,
          },
        },
      ],
      [
        'Preview your theme app extension at',
        {
          link: {
            label: `http://127.0.0.1:${themeExtensionPort}`,
            url: `http://127.0.0.1:${themeExtensionPort}`,
          },
        },
      ],
    ],
  })

  return {
    type: 'theme-app-extensions',
    prefix: 'theme-extensions',
    function: async () => {
      const server = await initializeDevelopmentExtensionServer(theme, {
        adminSession,
        storefrontPassword,
        themeExtensionDirectory,
        themeExtensionPort,
      })

      await server.start()
    },
    options: {
      developerPlatformClient: options.developerPlatformClient,
    },
  }
}

export async function findOrCreateHostTheme(adminSession: AdminSession, theme?: string): Promise<Theme> {
  let hostTheme: Theme | undefined
  if (theme) {
    outputDebug(`Fetching theme with provided id ${theme}`)
    hostTheme = await fetchTheme(parseInt(theme, 10), adminSession)
  } else {
    const themeManager = new HostThemeManager(adminSession, {devPreview: true})
    const tasks: Task[] = [
      {
        title: 'Configuring host theme for theme app extension',
        task: async () => {
          outputDebug('Finding or creating host theme for theme app extensions')
          hostTheme = await themeManager.findOrCreate()
        },
      },
    ]
    await renderTasks(tasks)
  }

  if (!hostTheme) {
    throw new AbortError(`Could not find or create a host theme for theme app extensions`)
  }

  return hostTheme
}

async function buildAppUrl(remoteApp: Omit<OrganizationApp, 'apiSecretKeys'>) {
  const fqdn = await partnersFqdn()

  return `https://${fqdn}/${remoteApp.organizationId}/apps/${remoteApp.id}/test`
}
