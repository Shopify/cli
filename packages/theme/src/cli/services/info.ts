import {getDevelopmentTheme, getThemeStore} from './local-storage.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {version as rubyVersion} from '@shopify/cli-kit/node/ruby'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {themeEditorUrl, themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {linesToColumns} from '@shopify/cli-kit/common/string'
import {OutputMessage, formatSection, getOutputUpdateCLIReminder} from '@shopify/cli-kit/node/output'

interface ThemeInfo {
  theme: {
    id: number
    name: string
    role: string
    shop: string
    editor_url: string
    preview_url: string
  }
}

interface ThemeInfoOptions {
  store?: string
  password?: string
  environment?: string
  development?: boolean
  theme?: string
  json?: boolean
}

export function themeInfoJSON(theme: Theme, adminSession: AdminSession): ThemeInfo {
  return {
    theme: {
      id: theme.id,
      name: theme.name,
      role: theme.role,
      shop: adminSession.storeFqdn,
      preview_url: themePreviewUrl(theme, adminSession),
      editor_url: themeEditorUrl(theme, adminSession),
    },
  }
}

export async function fetchThemeInfo(
  adminSession: AdminSession,
  options: ThemeInfoOptions,
): Promise<ThemeInfo | undefined> {
  let theme
  if (options.development) {
    const developmentThemeManager = new DevelopmentThemeManager(adminSession)
    theme = await developmentThemeManager.findOrCreate()
  } else {
    const filter = {filter: {theme: options.theme}}
    theme = await findOrSelectTheme(adminSession, filter)
  }
  return theme ? themeInfoJSON(theme, adminSession) : undefined
}

export async function fetchDevInfo(config: {cliVersion: string}): Promise<OutputMessage> {
  const sections: [string, string][] = [devConfigSection(), await systemInfoSection(config)]
  const message = sections.map((sectionContents) => formatSection(...sectionContents)).join('\n\n')
  return message
}

function devConfigSection(): [string, string] {
  const title = 'Theme Configuration'
  const store = getThemeStore() || 'Not configured'
  let developmentTheme = getDevelopmentTheme()
  developmentTheme = developmentTheme ? `#${developmentTheme}` : 'Not set'
  const lines: string[][] = [
    ['Store', store],
    ['Development Theme ID', developmentTheme],
  ]
  return [title, `${linesToColumns(lines)}`]
}

async function systemInfoSection(config: {cliVersion: string}): Promise<[string, string]> {
  const title = 'Tooling and System'
  const {platform, arch} = platformAndArch()
  const ruby = (await rubyVersion()) || 'Not installed'
  const lines: string[][] = [
    ['Shopify CLI', await cliVersionInfo(config)],
    ['OS', `${platform}-${arch}`],
    ['Shell', process.env.SHELL || 'unknown'],
    ['Node version', process.version],
    ['Ruby version', ruby],
  ]
  return [title, `${linesToColumns(lines)}`]
}

async function cliVersionInfo(config: {cliVersion: string}): Promise<string> {
  const dependency = '@shopify/cli'
  const newestVersion = await checkForNewVersion(dependency, config.cliVersion)
  if (!newestVersion) return config.cliVersion
  const upgradeMessage = getOutputUpdateCLIReminder(undefined, newestVersion)
  return [config.cliVersion, upgradeMessage].join(' ').trim()
}
