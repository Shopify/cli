import {uploadTheme} from './theme-uploader.js'
import {downloadTheme} from './theme-downloader.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export const THEME_DOWNLOAD_INTERVAL = 3000

interface ThemeEnvironmentOptions {
  themeEditorSync: boolean
}

export async function dev(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  options: ThemeEnvironmentOptions,
) {
  await ensureThemeEnvironment(targetTheme, session, remoteChecksums, localThemeFileSystem, options)

  // start DevServer
}

async function ensureThemeEnvironment(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  options?: ThemeEnvironmentOptions,
) {
  await uploadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem)
  if (options?.themeEditorSync) {
    pollRemoteThemeChanges(targetTheme, session, remoteChecksums, localThemeFileSystem)
  }
}

function pollRemoteThemeChanges(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
) {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setInterval(async () => {
    await downloadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem, {
      nodelete: false,
      only: ['json'],
    })
  }, THEME_DOWNLOAD_INTERVAL)
}
