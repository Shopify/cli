/* eslint-disable tsdoc/syntax */
import {downloadTheme} from '../utilities/theme-downloader.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {currentDirectoryConfirmed, themeComponent} from '../utilities/theme-ui.js'
import {rejectGeneratedStaticAssets} from '../utilities/asset-checksum.js'
import {showEmbeddedCLIWarning} from '../utilities/embedded-cli-warning.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {glob} from '@shopify/cli-kit/node/fs'
import {cwd} from '@shopify/cli-kit/node/path'

interface PullOptions {
  path: string
  nodelete: boolean
  force: boolean
  only?: string[]
  ignore?: string[]
}

export interface PullFlags {
  path?: string
  password?: string
  environment?: string
  store?: string
  theme?: string
  development?: boolean
  live?: boolean
  nodelete?: boolean
  only?: string[]
  ignore?: string[]
  force?: boolean
  noColor?: boolean
  verbose?: boolean
}

/**
 * Initiates the pull process based on provided flags.
 *
 * @param {PullFlags} flags - The flags for the pull operation.
 * @param {string} [flags.path] - The directory path to download the theme.
 * @param {string} [flags.password] - The password for authenticating with the store.
 * @param {string} [flags.store] - Store URL. It can be the store prefix (example.myshopify.com) or the full myshopify.com URL (https://example.myshopify.com).
 * @param {string} [flags.environment] - The environment to apply to the current command.
 * @param {string} [flags.theme] - Theme ID or name of the remote theme.
 * @param {boolean} [flags.develop`ment] - Pull theme files from your remote development theme.
 * @param {boolean} [flags.live] - Pull theme files from your remote live theme.
 * @param {boolean} [flags.nodelete] - Runs the pull command without deleting local files.
 * @param {string[]} [flags.only] - Download only the specified files (Multiple flags allowed).
 * @param {string[]} [flags.ignore] - Skip downloading the specified files (Multiple flags allowed).
 * @param {boolean} [flags.force] - Proceed without confirmation, if current directory does not seem to be theme directory.
 * @param {boolean} [flags.noColor] - Disable color output.
 * @param {boolean} [flags.verbose] - Increase the verbosity of the output.
 * @returns {Promise<void>} Resolves when the pull operation is complete.
 */
export async function pull(flags: PullFlags) {
  showEmbeddedCLIWarning()

  const store = ensureThemeStore({store: flags.store})
  const adminSession = await ensureAuthenticatedThemes(store, flags.password)

  const developmentThemeManager = new DevelopmentThemeManager(adminSession)
  const developmentTheme = await (flags.development ? developmentThemeManager.find() : developmentThemeManager.fetch())

  const {path, nodelete, live, development, only, ignore, force} = flags

  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    filter: {
      live,
      theme: development ? `${developmentTheme?.id}` : flags.theme,
    },
  })

  await executePull(theme, adminSession, {
    path: path || cwd(),
    nodelete: nodelete || false,
    only: only || [],
    ignore: ignore || [],
    force: force || false,
  })
}

/**
 * Executes the pull operation for a specific theme.
 *
 * @param {Theme} theme - The theme to pull.
 * @param {AdminSession} session - The admin session.
 * @param {PullOptions} options - The options for pulling.
 * @returns {Promise<void>} Resolves when the pull operation is complete.
 */
async function executePull(theme: Theme, session: AdminSession, options: PullOptions) {
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

  const themeFileSystem = mountThemeFileSystem(path, {filters: options})
  const [remoteChecksums] = await Promise.all([fetchChecksums(theme.id, session), themeFileSystem.ready()])
  const themeChecksums = rejectGeneratedStaticAssets(remoteChecksums)

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

/**
 * Checks if the specified directory is empty.
 *
 * @param {string} path - The path to the directory.
 * @returns {Promise<boolean>} True if the directory is empty, false otherwise.
 */
export async function isEmptyDir(path: string) {
  const entries = await glob('*', {
    cwd: path,
    deep: 1,
    onlyFiles: false,
  })

  return entries.length === 0
}
