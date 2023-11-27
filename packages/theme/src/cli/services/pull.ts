import {downloadTheme} from '../utilities/theme-downloader.js'
import {loadLocalTheme} from '../utilities/theme-fs.js'
import {Theme} from '@shopify/cli-kit/node/themes/models/index'
import {AdminSession} from '@shopify/cli-kit/node/session'

interface PullOptions {
  theme: Theme
  path: string
}

export async function pull(options: PullOptions, adminSession: AdminSession) {
  const localTheme = await loadLocalTheme(options.path)

  await downloadTheme(options.theme, localTheme, adminSession)
}
