import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {uploadTheme} from '../theme-uploader.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

export interface DevServerSession extends AdminSession {
  storefrontToken: string
}

export interface DevServerContext {
  session: DevServerSession
  remoteChecksums: Checksum[]
  localThemeFileSystem: ThemeFileSystem
  themeEditorSync: boolean
}

export async function startDevServer(theme: Theme, ctx: DevServerContext, onReady: () => void) {
  await ensureThemeEnvironmentSetup(theme, ctx)

  onReady()
}

async function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  if (ctx.themeEditorSync) {
    await reconcileAndPollThemeEditorChanges(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem)
  }

  await uploadTheme(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem, {})
}
