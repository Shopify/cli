import {getDevelopmentTheme, getThemeStore} from './local-storage.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {themeEditorUrl, themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AlertCustomSection, InlineToken} from '@shopify/cli-kit/node/ui'

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

export async function fetchDevInfo(config: {cliVersion: string}): Promise<AlertCustomSection[]> {
  return [devConfigSection(), await systemInfoSection(config)]
}

function devConfigSection(): AlertCustomSection {
  const store = getThemeStore() || 'Not configured'
  const developmentTheme = getDevelopmentTheme()
  return tabularSection('Theme Configuration', [
    ['Store', store],
    ['Development Theme ID', developmentTheme ? `#${developmentTheme}` : {subdued: 'Not set'}],
  ])
}

async function systemInfoSection(config: {cliVersion: string}): Promise<AlertCustomSection> {
  const {platform, arch} = platformAndArch()
  return tabularSection('Tooling and System', [
    ['Shopify CLI', config.cliVersion],
    ['OS', `${platform}-${arch}`],
    ['Shell', process.env.SHELL || 'unknown'],
    ['Node version', process.version],
  ])
}

function tabularSection(title: string, data: InlineToken[][]): AlertCustomSection {
  return {
    title,
    body: {tabularData: data, firstColumnSubdued: true},
  }
}
