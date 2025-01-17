import {downloadTheme} from '../utilities/theme-downloader.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {ensureDirectoryConfirmed, themeComponent} from '../utilities/theme-ui.js'
import {rejectGeneratedStaticAssets} from '../utilities/asset-checksum.js'
import {showEmbeddedCLIWarning} from '../utilities/embedded-cli-warning.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {configureCLIEnvironment} from '../utilities/cli-config.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {glob} from '@shopify/cli-kit/node/fs'
import {cwd} from '@shopify/cli-kit/node/path'
import {insideGitDirectory, isClean} from '@shopify/cli-kit/node/git'

interface PullOptions {
  path: string
  nodelete: boolean
  force: boolean
  only?: string[]
  ignore?: string[]
}

export interface PullFlags {
  /**
   * The directory path to download the theme.
   */
  path?: string

  /**
   * The password for authenticating with the store.
   */
  password?: string

  /**
   * Store URL. It can be the store prefix (example.myshopify.com) or the full myshopify.com URL (https://example.myshopify.com).
   */
  store?: string

  /**
   * Theme ID or name of the remote theme.
   */
  theme?: string

  /**
   * Pull theme files from your remote development theme.
   */
  development?: boolean

  /**
   * Pull theme files from your remote live theme.
   */
  live?: boolean

  /**
   * Runs the pull command without deleting local files.
   */
  nodelete?: boolean

  /**
   * Download only the specified files (Multiple flags allowed).
   */
  only?: string[]

  /**
   * Skip downloading the specified files (Multiple flags allowed).
   */
  ignore?: string[]

  /**
   * Proceed without confirmation, if current directory does not seem to be theme directory.
   */
  force?: boolean

  /**
   * Disable color output.
   */
  noColor?: boolean

  /**
   * Increase the verbosity of the output.
   */
  verbose?: boolean
}

/**
 * Pulls the theme files from an authenticated store. Will prompt to select a
 * theme if not provided.
 *
 * @param flags - All flags are optional.
 */
export async function pull(flags: PullFlags, adminSession2?: AdminSession): Promise<void> {
  configureCLIEnvironment({verbose: flags.verbose, noColor: flags.noColor})
  showEmbeddedCLIWarning()

  let adminSession: AdminSession

  if (!adminSession2) {
    const store = ensureThemeStore({store: flags.store})
    adminSession = await ensureAuthenticatedThemes(store, flags.password)
  } else {
    adminSession = adminSession2
  }

  const developmentThemeManager = new DevelopmentThemeManager(adminSession)
  const developmentTheme = await (flags.development ? developmentThemeManager.find() : developmentThemeManager.fetch())

  const {path, nodelete, live, development, only, ignore, force} = flags

  if (!(await validateDirectory(path ?? cwd(), force ?? false))) {
    return
  }

  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    filter: {
      live,
      theme: development ? `${developmentTheme?.id}` : flags.theme,
    },
  })

  await executePull(theme, adminSession, {
    path: path ?? cwd(),
    nodelete: nodelete ?? false,
    only: only ?? [],
    ignore: ignore ?? [],
    force: force ?? false,
  })
}

/**
 * Executes the pull operation for a specific theme.
 *
 * @param theme - the remote theme to be downloaded by the pull command
 * @param session - the admin session to access the API and download the theme
 * @param options - the options that modify how the theme gets downloaded
 */
async function executePull(theme: Theme, session: AdminSession, options: PullOptions) {
  const themeFileSystem = mountThemeFileSystem(options.path, {filters: options})
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
 * @param  path - The path to the directory.
 * @returns  True if the directory is empty, false otherwise.
 */
export async function isEmptyDir(path: string) {
  const entries = await glob('*', {
    cwd: path,
    deep: 1,
    onlyFiles: false,
  })

  return entries.length === 0
}

/**
 * Validates the directory before pulling the theme.
 *
 * @param path - The path to the directory.
 * @param force - Whether to force the pull operation.
 * @returns Whether the directory is valid.
 */
async function validateDirectory(path: string, force: boolean) {
  if (force) return true

  /**
   * If users are not forcing the `pull` command, the directory is not empty,
   * and the directory doesn't look like a theme directory, we ask for
   * confirmation, because the `pull` command has the destructive behavior of
   * removing local assets that are not present remotely.
   */
  if (
    !(await isEmptyDir(path)) &&
    !(await hasRequiredThemeDirectories(path)) &&
    !(await ensureDirectoryConfirmed(force))
  ) {
    return false
  }

  /**
   * If users are not forcing the 'pull' command, and the current directory is a
   * Git directory and it is not clean, we ask for confirmation before proceeding.
   */
  const dirtyDirectory = (await insideGitDirectory(path)) && !(await isClean(path))

  if (
    dirtyDirectory &&
    !(await ensureDirectoryConfirmed(
      force,
      'The current Git directory has uncommitted changes. Do you want to proceed?',
    ))
  ) {
    return false
  }

  return true
}
