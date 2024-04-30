import {uploadTheme} from './theme-uploader.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export interface ThemeEnvironmentOptions {
  themeEditorSync: boolean
}

export async function startDevServer(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  options: ThemeEnvironmentOptions,
) {
  await ensureThemeEnvironmentSetup(targetTheme, session, remoteChecksums, localThemeFileSystem, options)
}

async function ensureThemeEnvironmentSetup(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  options: ThemeEnvironmentOptions,
) {
  if (!options.themeEditorSync) {
    await uploadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem, {})
  }
}
