import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {currentDirectoryConfirmed} from '../utilities/theme-ui.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {DevServerContext, LiveReload} from '../utilities/theme-environment/types.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {emptyThemeExtFileSystem} from '../utilities/theme-fs-empty.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AbortError} from '@shopify/cli-kit/node/error'
import {openURL} from '@shopify/cli-kit/node/system'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = '9292'

export interface DevOptions {
  adminSession: AdminSession
  directory: string
  store: string
  password?: string
  storePassword?: string
  open: boolean
  theme: Theme
  host?: string
  port?: string
  force: boolean
  'theme-editor-sync': boolean
  'live-reload': LiveReload
  noDelete: boolean
  ignore: string[]
  only: string[]
  notify?: string
}

export async function dev(options: DevOptions) {
  if (!(await hasRequiredThemeDirectories(options.directory)) && !(await currentDirectoryConfirmed(options.force))) {
    return
  }

  const storefrontPasswordPromise = isStorefrontPasswordProtected(options.adminSession.storeFqdn).then(
    (needsPassword) =>
      needsPassword ? ensureValidPassword(options.storePassword, options.adminSession.storeFqdn) : undefined,
  )

  const localThemeExtensionFileSystem = emptyThemeExtFileSystem()
  const localThemeFileSystem = mountThemeFileSystem(options.directory, {
    filters: options,
    notify: options.notify,
  })

  const host = options.host ?? DEFAULT_HOST
  if (options.port && !(await checkPortAvailability(Number(options.port)))) {
    throw new AbortError(
      `Port ${options.port} is not available. Try a different port or remove the --port flag to use an available port.`,
    )
  }

  const port = options.port ?? String(await getAvailableTCPPort(Number(DEFAULT_PORT)))

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
    // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
    openURL(`http://${host}:${port}`).catch((error: Error) => {
      renderWarning({headline: 'Failed to open the development server.', body: error.stack ?? error.message})
    })
  }
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
