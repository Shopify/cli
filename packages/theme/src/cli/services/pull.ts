import {downloadTheme} from '../utilities/theme-downloader.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {currentDirectoryConfirmed, themeComponent} from '../utilities/theme-ui.js'
import {rejectLiquidChecksums} from '../utilities/asset-checksum.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {glob} from '@shopify/cli-kit/node/fs'

interface PullOptions {
  path: string
  nodelete: boolean
  force: boolean
  only?: string[]
  ignore?: string[]
}

export async function pull(theme: Theme, session: AdminSession, options: PullOptions) {
  const path = options.path
  const force = options.force

  /**
   * If users are not forcing the `pull` command, the directory is not empty,
   * and the directory doesn't look like a theme directory, we ask for
   * confirmation, because the `pull` command has the destructive behavior of
   * removing local assets that are not present remotely.
   */
  if (
    !(await isEmptyDir(path)) &&
    !(await hasRequiredThemeDirectories(path)) &&
    !(await currentDirectoryConfirmed(force))
  ) {
    return
  }

  const remoteChecksums = await fetchChecksums(theme.id, session)
  const themeFileSystem = await mountThemeFileSystem(path)
  const themeChecksums = rejectLiquidChecksums(remoteChecksums)

  const store = session.storeFqdn
  const themeId = theme.id

  await downloadTheme(theme, session, themeChecksums, themeFileSystem, options)

  renderSuccess({
    body: ['The theme', ...themeComponent(theme), 'has been pulled.'],
    nextSteps: [
      [
        {
          link: {
            label: 'View your theme',
            url: `https://${store}/?preview_theme_id=${themeId}`,
          },
        },
      ],
      [
        {
          link: {
            label: 'Customize your theme at the theme editor',
            url: `https://${store}/admin/themes/${themeId}/editor`,
          },
        },
      ],
    ],
  })
}

export async function isEmptyDir(path: string) {
  const entries = await glob('*', {
    cwd: path,
    deep: 1,
    onlyFiles: false,
  })

  return entries.length === 0
}
