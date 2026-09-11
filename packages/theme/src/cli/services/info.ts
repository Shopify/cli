import {getDevelopmentTheme, getThemeStore} from './local-storage.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {themeEditorUrl, themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'
import type {ThemeEnvironmentInfo, ThemeInfoThemeResult} from './info/types.js'

interface ThemeInfoOptions {
  store?: string
  password?: string
  environment?: string[]
  development?: boolean
  theme?: string
  json?: boolean
}

export function themeInfoJSON(theme: Theme, adminSession: AdminSession): ThemeInfoThemeResult {
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

export function themeEnvironmentInfoJSON(config: {cliVersion: string}): ThemeEnvironmentInfo {
  return getThemeEnvironmentInfo(config).result
}

export function getThemeEnvironmentInfo(config: {cliVersion: string}): {
  result: ThemeEnvironmentInfo
  developmentTheme: string | undefined
} {
  const {platform, arch} = platformAndArch()
  const store = getThemeStore()
  const developmentTheme = store ? getDevelopmentTheme() : undefined
  const developmentThemeID = Number(developmentTheme) || null

  return {
    result: {
      store: store ?? 'Not configured',
      development_theme_id: developmentThemeID,
      cli_version: config.cliVersion,
      os: `${platform}-${arch}`,
      shell: process.env.SHELL ?? 'unknown',
      node_version: process.version,
    },
    developmentTheme,
  }
}

export async function fetchThemeInfo(
  adminSession: AdminSession,
  options: ThemeInfoOptions,
): Promise<ThemeInfoThemeResult | undefined> {
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
