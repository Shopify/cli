import {withThemeDevOutput} from './dev/output.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {
  type DevServerContext,
  type ErrorOverlayMode,
  type LiveReload,
  type ReconciliationStrategy,
} from '../utilities/theme-environment/types.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {emptyThemeExtFileSystem} from '../utilities/theme-fs-empty.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {fetchOrCreateCrawlerSignatureHeaders} from '../utilities/theme-environment/crawler-signature.js'
import {ensureListingExists} from '../utilities/theme-listing.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AbortError} from '@shopify/cli-kit/node/error'
import {openURL, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {debounce} from '@shopify/cli-kit/common/function'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {hashString} from '@shopify/cli-kit/node/crypto'
import chalk from '@shopify/cli-kit/node/colors'
import {withDevInstance, type DevInstance} from '@shopify/cli-kit/node/dev-instance'
import {Config} from '@oclif/core'

import readline from 'readline'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 9292

let hasReportedAnalyticsEvent = false

interface DevOptions {
  adminSession: AdminSession
  commandConfig: Config
  directory: string
  store: string
  password?: string
  storePassword?: string
  open: boolean
  theme: Theme
  host?: string
  port?: number
  force: boolean
  'standard-events-inspector': boolean
  'theme-editor-sync': boolean
  reconciliationStrategy?: ReconciliationStrategy
  'live-reload': LiveReload
  'error-overlay': ErrorOverlayMode
  noDelete: boolean
  ignore: string[]
  only: string[]
  notify?: string
  listing?: string
  json?: boolean
}

export async function dev(options: DevOptions) {
  if (!(await hasRequiredThemeDirectories(options.directory)) && !(await ensureDirectoryConfirmed(options.force))) {
    return
  }

  if (options.password?.startsWith('shpat_')) {
    renderWarning({
      headline: 'Admin API token missing features:',
      body: [
        `Directly using an Admin API token will result in some missing features.`,
        `We recommend generating a password from the Theme Access app.`,
        `Alternatively, you can authenticate normally by not passing the --password flag.`,
        `\n`,
        {
          list: {
            title: 'Known limitations:',
            items: ['Hot module reloading', 'Password protected storefronts'],
          },
        },
      ],
      link: {
        label: 'Theme Access app',
        url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-access',
      },
    })
  }

  if (options.listing) {
    await ensureListingExists(options.directory, options.listing)
  }

  await withDevInstance(
    {
      command: 'theme dev',
      directory: options.directory,
      key: `${options.store}:${options.theme.id}`,
      logOutput: options.json ? process.stdout : undefined,
      details: {
        store: options.store,
        themeId: options.theme.id,
        themeName: options.theme.name,
        listing: options.listing,
      },
    },
    async (instance) => {
      const controller = new AbortController()
      const stop = () => controller.abort()
      const onInstanceError = () => controller.abort(instance.abortSignal.reason)
      process.on('shopify:signal', stop)
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
      instance.abortSignal.addEventListener('abort', onInstanceError, {once: true})
      try {
        await withThemeDevOutput(instance, () => runDev(options, instance, controller), options.json)
        instance.abortSignal.throwIfAborted()
      } finally {
        controller.abort()
        process.off('shopify:signal', stop)
        process.off('SIGINT', stop)
        process.off('SIGTERM', stop)
        instance.abortSignal.removeEventListener('abort', onInstanceError)
      }
    },
  )

  await reportDevAnalytics(options.commandConfig, options.adminSession)
  process.exit(0)
}

async function runDev(options: DevOptions, instance: DevInstance, controller: AbortController) {
  const {signal} = controller
  const [crawlerSignatureHeaders, isPasswordProtected] = await Promise.all([
    fetchOrCreateCrawlerSignatureHeaders(options.adminSession),
    isStorefrontPasswordProtected(options.adminSession),
  ])
  const storefrontPassword = isPasswordProtected
    ? await ensureValidPassword(options.storePassword, options.adminSession.storeFqdn, crawlerSignatureHeaders)
    : undefined

  if (signal.aborted) return

  const localThemeExtensionFileSystem = emptyThemeExtFileSystem()
  const localThemeFileSystem = mountThemeFileSystem(options.directory, {
    filters: options,
    listing: options.listing,
    noDelete: options.noDelete,
    notify: options.notify,
    signal,
  })

  const host = options.host ?? DEFAULT_HOST
  let port: number
  if (options.port) {
    if (!(await checkPortAvailability(options.port))) {
      throw new AbortError(
        `Port ${options.port} is not available. Try a different port or remove the --port flag to use an available port.`,
      )
    }
    port = options.port
  } else {
    port = await getAvailableTCPPort(DEFAULT_PORT)
  }

  const urls = {
    local: `http://${host}:${port}`,
    giftCard: `http://${host}:${port}/gift_cards/[store_id]/preview`,
    themeEditor: `https://${options.store}/admin/themes/${options.theme.id}/editor?hr=${port}`,
    preview: `https://${options.store}/?preview_theme_id=${options.theme.id}`,
  }

  await instance.update({details: {host, port, urls}})

  const session = await initializeDevServerSession(
    options.theme.id.toString(),
    options.adminSession,
    options.password,
    storefrontPassword,
    crawlerSignatureHeaders,
    signal,
  )
  if (signal.aborted) return

  const ctx: DevServerContext = {
    signal,
    session,
    localThemeFileSystem,
    localThemeExtensionFileSystem,
    directory: options.directory,
    type: 'theme',
    lastRequestedPath: '',
    options: {
      themeEditorSync: options['theme-editor-sync'],
      reconciliationStrategy: options.reconciliationStrategy,
      host,
      port,
      open: options.open,
      liveReload: options['live-reload'],
      standardEventsDevBundle: true,
      standardEventsInspector: options['standard-events-inspector'],
      noDelete: options.noDelete,
      ignore: options.ignore,
      only: options.only,
      errorOverlay: options['error-overlay'],
    },
  }

  const {serverStart, serverStop, workPromise, renderDevSetupProgress, backgroundJobPromise} = setupDevServer(
    options.theme,
    ctx,
  )
  const acceptsInput = !options.json && terminalSupportsPrompting()
  const keypressHandler = createKeypressHandler(urls, ctx, () => controller.abort())
  const {promise: stopped, resolve: resolveStopped} = Promise.withResolvers<void>()
  const onAbort = () => resolveStopped()
  signal.addEventListener('abort', onAbort, {once: true})

  try {
    if (acceptsInput) {
      readline.emitKeypressEvents(process.stdin)
      process.stdin.on('keypress', keypressHandler)
    }

    const start = async () => {
      await renderDevSetupProgress()
      if (signal.aborted) return
      await serverStart()
      if (signal.aborted) return
      if (acceptsInput) process.stdin.setRawMode(true)
      renderLinks(urls)
      if (options.open) openURLSafely(urls.local, 'development server')
      await workPromise
      if (signal.aborted) return
      await instance.update({status: 'running'})
    }

    await Promise.race([Promise.all([backgroundJobPromise, start()]), stopped])
  } finally {
    controller.abort()
    signal.removeEventListener('abort', onAbort)
    process.stdin.off('keypress', keypressHandler)
    if (acceptsInput) process.stdin.setRawMode(false)
    await serverStop()
  }
}

export async function reportDevAnalytics(config: Config, session: AdminSession): Promise<void> {
  if (hasReportedAnalyticsEvent) return
  hasReportedAnalyticsEvent = true

  try {
    await addPublicMetadata(() => ({store_fqdn_hash: hashString(session.storeFqdn)}))
    await addSensitiveMetadata(() => ({store_fqdn: session.storeFqdn}))
    await reportAnalyticsEvent({config, exitMode: 'ok'})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_error) {
    // Analytics must never block exit.
  }
}

export function createKeypressHandler(
  urls: {local: string; giftCard: string; themeEditor: string; preview: string},
  ctx: {lastRequestedPath: string},
  onClose: () => void,
) {
  const debouncedOpenURL = debounce(openURLSafely, 100, {leading: true, trailing: false})

  return (_str: string, key: {ctrl?: boolean; name?: string}) => {
    if (key.ctrl && key.name === 'c') {
      onClose()
      return
    }

    switch (key.name) {
      case undefined:
        break
      case 't':
        debouncedOpenURL(urls.local, 'localhost')
        break
      case 'p':
        debouncedOpenURL(urls.preview, 'theme preview')
        break
      case 'e':
        debouncedOpenURL(
          ctx.lastRequestedPath === '/'
            ? urls.themeEditor
            : `${urls.themeEditor}&previewPath=${encodeURIComponent(ctx.lastRequestedPath)}`,
          'theme editor',
        )
        break
      case 'g':
        debouncedOpenURL(urls.giftCard, 'gift card preview')
        break
      default:
        break
    }
  }
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
