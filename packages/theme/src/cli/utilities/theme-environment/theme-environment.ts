import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {uploadTheme} from '../theme-uploader.js'
import {createApp, defineEventHandler} from 'h3'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {createServer} from 'node:http'

export async function setupDevServer(theme: Theme, ctx: DevServerContext, onReady: () => void) {
  await ensureThemeEnvironmentSetup(theme, ctx)
  await startDevelopmentServer(theme, ctx)

  onReady()
}

async function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  if (ctx.options.themeEditorSync) {
    await reconcileAndPollThemeEditorChanges(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem, {
      noDelete: ctx.options.noDelete,
      ignore: ctx.options.ignore,
      only: ctx.options.only,
    })
  }

  await uploadTheme(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem, {
    nodelete: ctx.options.noDelete,
    ignore: ctx.options.ignore,
    only: ctx.options.only,
  })
}

function startDevelopmentServer(_theme: Theme, ctx: DevServerContext) {
  const app = createApp()

  app.use(
    defineEventHandler((_event) => {
      return 'Hello, world!'
    }),
  )

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return new Promise((resolve) => createServer(app).listen(ctx.options.port, () => resolve(undefined)))
}
