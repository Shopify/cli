import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {currentDirectoryConfirmed} from '../utilities/theme-ui.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {DevServerContext, DevServerSession} from '../utilities/theme-environment/types.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AdminSession, ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'

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
  open: boolean
  theme: Theme
  host?: string
  port?: string
  force: boolean
  flagsToPass: string[]
  'dev-preview': boolean
  'theme-editor-sync': boolean
  'live-reload': string
  noDelete: boolean
  ignore: string[]
  only: string[]
}

export async function dev(options: DevOptions) {
  if (!options['dev-preview']) {
    await legacyDev(options)
    return
  }

  if (!(await hasRequiredThemeDirectories(options.directory)) && !(await currentDirectoryConfirmed(options.force))) {
    return
  }

  if (options.flagsToPass.includes('--poll')) {
    renderWarning({
      body: 'The CLI flag --[flag-name] is now deprecated and will be removed in future releases. It is no longer necessary with the new implementation. Please update your usage accordingly.',
    })
  }

  outputInfo('This feature is currently in development and is not ready for use or testing yet.')

  const remoteChecksums = await fetchChecksums(options.theme.id, options.adminSession)
  const localThemeFileSystem = await mountThemeFileSystem(options.directory)
  const session: DevServerSession = {
    ...options.adminSession,
    storefrontToken: options.storefrontToken,
    expiresAt: new Date(),
  }

  const host = options.host || DEFAULT_HOST
  const port = options.port || DEFAULT_PORT

  const ctx: DevServerContext = {
    session,
    remoteChecksums,
    localThemeFileSystem,
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

  await setupDevServer(options.theme, ctx, () => {
    renderLinks(options.store, options.theme.id.toString(), host, port)
  })
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

export async function refreshTokens(store: string, password: string | undefined) {
  const adminSession = await ensureAuthenticatedThemes(store, password, [], true)
  const storefrontToken = await ensureAuthenticatedStorefront([], password)
  if (useEmbeddedThemeCLI()) {
    await execCLI2(['theme', 'token', '--admin', adminSession.token, '--sfr', storefrontToken])
  }
  return {adminSession, storefrontToken}
}
