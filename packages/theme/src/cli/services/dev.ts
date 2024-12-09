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
import chalk from '@shopify/cli-kit/node/colors'
import readline from 'readline'

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
  silence?: boolean
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
    noDelete: options.noDelete,
  })

  const host = options.host ?? DEFAULT_HOST
  if (options.port && !(await checkPortAvailability(Number(options.port)))) {
    throw new AbortError(
      `Port ${options.port} is not available. Try a different port or remove the --port flag to use an available port.`,
    )
  }

  const port = options.port ?? String(await getAvailableTCPPort(Number(DEFAULT_PORT)))

  const urls = {
    local: `http://${host}:${port}`,
    giftCard: `http://${host}:${port}/gift_cards/[store_id]/preview`,
    themeEditor: `https://${options.store}/admin/themes/${options.theme.id}/editor`,
    preview: `https://${options.store}/?preview_theme_id=${options.theme.id}`,
  }

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
      silence: options.silence ?? false,
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

  renderLinks(urls)
  if (options.open) {
    openURLSafely(urls.local, 'development server')
  }

  readline.emitKeypressEvents(process.stdin)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  process.stdin.on('keypress', (_str, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit()
    }

    switch (key.name) {
      case 't':
        openURLSafely(urls.local, 'localhost')
        break
      case 'p':
        openURLSafely(urls.preview, 'theme preview')
        break
      case 'e':
        openURLSafely(urls.themeEditor, 'theme editor')
        break
      case 'g':
        openURLSafely(urls.giftCard, 'gift card preview')
        break
    }
  })
}

export function openURLSafely(url: string, label: string) {
  openURL(url).catch(handleOpenURLError(label))
}

function handleOpenURLError(message: string) {
  return (error: Error) => {
    renderWarning({
      headline: `Failed to open ${message}.`,
      body: error.stack ?? error.message,
    })
  }
}

export function renderLinks(urls: {local: string; giftCard: string; themeEditor: string; preview: string}) {
  renderSuccess({
    body: [
      {
        list: {
          title: chalk.bold('Preview your theme ') + chalk.cyan('(t)'),
          items: [
            {
              link: {
                url: urls.local,
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
            label: `Share your theme preview ${chalk.cyan('(p)')}`,
            url: urls.preview,
          },
        },
        {
          subdued: urls.preview,
        },
      ],
      [
        {
          link: {
            label: `Customize your theme at the theme editor ${chalk.cyan('(e)')}`,
            url: urls.themeEditor,
          },
        },
      ],
      [
        {
          link: {
            label: `Preview your gift cards ${chalk.cyan('(g)')}`,
            url: urls.giftCard,
          },
        },
      ],
    ],
  })
}
