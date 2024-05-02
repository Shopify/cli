import {downloadTheme} from './theme-downloader.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'

export const THEME_DOWNLOAD_INTERVAL = 3000

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
  // await uploadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem)
  if (options?.themeEditorSync) {
    await downloadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem, {nodelete: false})
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    pollRemoteThemeChanges(targetTheme, session, remoteChecksums, localThemeFileSystem)
    outputInfo('Theme editor sync enabled')
  }
}

// Using a recursive setTimeout to poll for changes to account for downloadTheme taking longer than THEME_DOWNLOAD_INTERVAL
// https://developer.mozilla.org/en-US/docs/Web/API/setInterval#ensure_that_execution_duration_is_shorter_than_interval_frequency
export async function pollRemoteThemeChanges(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
) {
  setTimeout(() => {
    outputInfo('Looking for theme changes...')

    downloadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem, {nodelete: false})
      .then(async () => {
        outputInfo('Finished downloading theme')
        await pollRemoteThemeChanges(targetTheme, session, remoteChecksums, localThemeFileSystem)
      })
      .catch((error) => {
        outputDebug(`Error while polling for theme changes: ${error}`)
        throw error
      })
  }, THEME_DOWNLOAD_INTERVAL)
}
