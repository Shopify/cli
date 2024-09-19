import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {currentDirectoryConfirmed} from '../utilities/theme-ui.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {DevServerContext, LiveReload} from '../utilities/theme-environment/types.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {emptyThemeExtFileSystem} from '../utilities/theme-fs-empty.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {renderInfo, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AdminSession, ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AbortError} from '@shopify/cli-kit/node/error'
import {openURL} from '@shopify/cli-kit/node/system'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = '9292'

// Tokens are valid for 120 min, better to be safe and refresh every 110 min
const THEME_REFRESH_TIMEOUT_IN_MS = 110 * 60 * 1000

export interface DevOptions {
  adminSession: AdminSession
  storefrontToken: string
  directory: string
  store: string
  password?: string
  storePassword?: string
  open: boolean
  theme: Theme
  host?: string
  port?: string
  force: boolean
  flagsToPass: string[]
  legacy: boolean
  'theme-editor-sync': boolean
  'live-reload': LiveReload
  noDelete: boolean
  ignore: string[]
  only: string[]
  notify?: string
}

export async function dev(options: DevOptions) {
  if (options.legacy) {
    await legacyDev(options)
    return
  }

  showNewVersionInfo()

  if (!(await hasRequiredThemeDirectories(options.directory)) && !(await currentDirectoryConfirmed(options.force))) {
    return
  }

  const storefrontPasswordPromise = isStorefrontPasswordProtected(options.adminSession.storeFqdn).then(
    (needsPassword) =>
      needsPassword ? ensureValidPassword(options.storePassword, options.adminSession.storeFqdn) : undefined,
  )

  if (options.flagsToPass.includes('--poll')) {
    renderWarning({
      body: 'The CLI flag --pull is now deprecated and will be removed in future releases. It is no longer necessary with the new implementation. Please update your usage accordingly.',
    })
  }

  const localThemeExtensionFileSystem = emptyThemeExtFileSystem()
  const localThemeFileSystem = mountThemeFileSystem(options.directory, {
    filters: options,
    notify: options.notify,
  })

  const host = options.host || DEFAULT_HOST
  if (options.port && !(await checkPortAvailability(Number(options.port)))) {
    throw new AbortError(
      `Port ${options.port} is not available. Try a different port or remove the --port flag to use an available port.`,
    )
  }

  const port = options.port || String(await getAvailableTCPPort(Number(DEFAULT_PORT)))

  const storefrontPassword = await storefrontPasswordPromise
  const session = await initializeDevServerSession(
    options.theme.id.toString(),
    options.adminSession,
    options.password,
    storefrontPassword,
  )
  const ctx: DevServerContext = {
    session,
    localThemeFileSystem,
    localThemeExtensionFileSystem,
    directory: options.directory,
    options: {
      themeEditorSync: options['theme-editor-sync'],
      host,
      port,
      open: options.open,
      liveReload: options['live-reload'],
      noDelete: options.noDelete,
      ignore: options.ignore,
      only: options.only,
    },
  }

  if (options['theme-editor-sync']) {
    session.storefrontPassword = await storefrontPasswordPromise
  }

  const {serverStart, renderDevSetupProgress} = setupDevServer(options.theme, ctx)

  if (!options['theme-editor-sync']) {
    session.storefrontPassword = await storefrontPasswordPromise
  }

  await renderDevSetupProgress()
  await serverStart()

  renderLinks(options.store, String(options.theme.id), host, port)
  if (options.open) {
    openURL(`http://${host}:${port}`).catch((error: Error) => {
      renderWarning({headline: 'Failed to open the development server.', body: error.stack ?? error.message})
    })
  }
}

async function legacyDev(options: DevOptions) {
  if (!(await hasRequiredThemeDirectories(options.directory)) && !(await currentDirectoryConfirmed(options.force))) {
    return
  }

  let adminToken: string | undefined = options.adminSession.token
  let storefrontToken: string | undefined = options.storefrontToken

  renderLinks(options.store, options.theme.id.toString(), options.host, options.port)

  const command = ['theme', 'serve', options.directory, ...options.flagsToPass]

  if (options.open && useEmbeddedThemeCLI()) {
    command.push('--open')
  }

  if (!options.password && useEmbeddedThemeCLI()) {
    adminToken = undefined
    storefrontToken = undefined

    /**
     * Executes the theme serve command.
     * Every 110 minutes, it will refresh the session token.
     */
    setInterval(() => {
      outputDebug('Refreshing theme session tokens...')
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      refreshTokens(options.store, options.password)
    }, THEME_REFRESH_TIMEOUT_IN_MS)
  }

  await execCLI2(command, {store: options.store, adminToken, storefrontToken})
}

function renderLinks(store: string, themeId: string, host = DEFAULT_HOST, port = DEFAULT_PORT) {
  renderSuccess({
    body: [
      {
        list: {
          title: {bold: 'Preview your theme'},
          items: [
            {
              link: {
                url: `http://${host}:${port}`,
              },
            },
          ],
        },
      },
    ],
    nextSteps: [
      [
        {
          link: {
            label: 'Customize your theme at the theme editor',
            url: `https://${store}/admin/themes/${themeId}/editor`,
          },
        },
      ],
      [
        {
          link: {
            label: 'Share your theme preview',
            url: `https://${store}/?preview_theme_id=${themeId}`,
          },
        },
        {
          subdued: `(https://${store}/?preview_theme_id=${themeId})`,
        },
      ],
    ],
  })
}

export function showDeprecationWarnings(args: string[]) {
  const eFlagIndex = args.findIndex((arg) => arg === '-e')
  const wrongEnvFlag = eFlagIndex >= 0 && (!args[eFlagIndex + 1] || args[eFlagIndex + 1]?.startsWith('-'))
  if (wrongEnvFlag) {
    renderWarning({
      body: [
        'If you want to enable synchronization with Theme Editor, please use',
        {command: '--theme-editor-sync'},
        {char: '.'},
        'The shortcut',
        {command: '-e'},
        'is now reserved for environments.',
      ],
    })
  }
}

export async function refreshTokens(store: string, password: string | undefined, refreshRubyCLI = true) {
  const adminSession = await ensureAuthenticatedThemes(store, password, [], true)
  const storefrontToken = await ensureAuthenticatedStorefront([], password)

  if (refreshRubyCLI && useEmbeddedThemeCLI()) {
    await execCLI2(['theme', 'token', '--admin', adminSession.token, '--sfr', storefrontToken])
  }

  return {adminSession, storefrontToken}
}

function showNewVersionInfo() {
  renderInfo({
    headline: [`You're using the new version of`, {command: 'shopify theme dev'}, {char: '.'}],
    body: ['Run', {command: 'shopify theme dev --legacy'}, 'to switch back to the previous version.'],
  })
}
