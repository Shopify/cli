import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {uploadTheme} from '../theme-uploader.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'

export async function startDevServer(theme: Theme, ctx: DevServerContext, onReady: () => void) {
  await ensureThemeEnvironmentSetup(theme, ctx)

  onReady()
}

async function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  if (ctx.themeEditorSync) {
    await reconcileAndPollThemeEditorChanges(
      theme,
      ctx.session,
      ctx.remoteChecksums,
      ctx.localThemeFileSystem,
      ctx.options,
    )
  }

  await uploadTheme(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem, {
    nodelete: ctx.options.noDelete,
    ignore: ctx.options?.ignore,
    only: ctx.options?.only,
  })
}
