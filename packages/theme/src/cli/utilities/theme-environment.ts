import {uploadTheme} from './theme-uploader.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export async function dev(
  developmentTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
) {
  await ensureThemeEnvironment(developmentTheme, session, remoteChecksums, localThemeFileSystem)
}

async function ensureThemeEnvironment(
  developmentTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
) {
  await uploadTheme(developmentTheme, session, remoteChecksums, localThemeFileSystem)
}
