import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {setupDevServer} from '../utilities/theme-environment/theme-environment.js'
import {DevServerContext, ErrorOverlayMode, LiveReload} from '../utilities/theme-environment/types.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {emptyThemeExtFileSystem} from '../utilities/theme-fs-empty.js'
import {initializeDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {ensureListingExists} from '../utilities/theme-listing.js'
import {Panel} from '../ui/components/Panel.js'
import {Cell, StyledTable} from '../ui/components/StyledTable.js'
import {ThemeDevUI, DevUrls} from '../ui/components/ThemeDevUI.js'
import {DevSessionOutput} from '../ui/DevSessionOutput.js'
import {renderThemeView} from '../ui/render.js'
import {palette} from '../ui/palette.js'
import {Box, Text} from '@shopify/cli-kit/node/ink'
import {render, renderSuccess, renderWarning, TokenItem} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {AbortError} from '@shopify/cli-kit/node/error'
import {openURL, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {debounce} from '@shopify/cli-kit/common/function'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {hashString} from '@shopify/cli-kit/node/crypto'
import chalk from '@shopify/cli-kit/node/colors'
import {Config} from '@oclif/core'
import React from 'react'

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
  'live-reload': LiveReload
  'error-overlay': ErrorOverlayMode
  noDelete: boolean
  ignore: string[]
  only: string[]
  notify?: string
  listing?: string
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

  const storefrontPasswordPromise = await isStorefrontPasswordProtected(options.adminSession).then((needsPassword) =>
    needsPassword ? ensureValidPassword(options.storePassword, options.adminSession.storeFqdn) : undefined,
  )

  // The persistent Ink view is only used on the TTY path. Its per-session output
  // sink is created here (before the file system + context) so live writers can
  // be routed into the view instead of raw stderr. On the non-TTY path it stays
  // undefined and every writer keeps its current raw output, byte-for-byte.
  const isInteractive = terminalSupportsPrompting()
  const devSessionOutput = isInteractive ? new DevSessionOutput() : undefined

  const localThemeExtensionFileSystem = emptyThemeExtFileSystem()
  const localThemeFileSystem = mountThemeFileSystem(options.directory, {
    filters: options,
    listing: options.listing,
    noDelete: options.noDelete,
    notify: options.notify,
    logSyncLine: devSessionOutput ? (line) => devSessionOutput.log(line) : undefined,
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
    type: 'theme',
    lastRequestedPath: '',
    sink: devSessionOutput,
    options: {
      themeEditorSync: options['theme-editor-sync'],
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

  const {serverStart, renderDevSetupProgress, backgroundJobPromise, resolveBackgroundJob} = setupDevServer(
    options.theme,
    ctx,
  )

  if (devSessionOutput) {
    await runInteractiveDevServer({
      themeName: options.theme.name,
      urls,
      ctx,
      open: options.open,
      renderDevSetupProgress,
      serverStart,
      backgroundJobPromise,
      resolveBackgroundJob,
      devSessionOutput,
    })
  } else {
    await runNonInteractiveDevServer({
      themeName: options.theme.name,
      urls,
      ctx,
      open: options.open,
      renderDevSetupProgress,
      serverStart,
      backgroundJobPromise,
      resolveBackgroundJob,
    })
  }

  await reportDevAnalytics(options.commandConfig, options.adminSession)

  process.exit(0)
}

interface DevServerLifecycle {
  themeName: string
  urls: DevUrls
  ctx: {lastRequestedPath: string}
  open: boolean
  renderDevSetupProgress: () => Promise<void>
  serverStart: () => Promise<unknown>
  backgroundJobPromise: Promise<void>
  resolveBackgroundJob: () => void
}

interface InteractiveDevServerLifecycle extends DevServerLifecycle {
  devSessionOutput: DevSessionOutput
}

/**
 * TTY path: a single persistent Ink root that stays mounted for the life of the
 * dev server. Ctrl-C is owned by the view (`useInput` → `abortController.abort()`),
 * which resolves `render()` and, in turn, the background job — preserving the
 * existing Ctrl-C → analytics → `process.exit(0)` teardown.
 */
async function runInteractiveDevServer({
  themeName,
  urls,
  ctx,
  open,
  renderDevSetupProgress,
  serverStart,
  backgroundJobPromise,
  resolveBackgroundJob,
  devSessionOutput,
}: InteractiveDevServerLifecycle) {
  const abortController = new AbortController()
  const debouncedOpenURL = debounce(openURLSafely, 100, {leading: true, trailing: false})

  const onOpenURL = (key: 't' | 'p' | 'e' | 'g') => {
    switch (key) {
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
    }
  }

  // Once the view unmounts (Ctrl-C / abort), resolve the background job so the
  // Promise.all below completes and teardown proceeds.
  const renderPromise = renderThemeDevUI({themeName, urls, abortController, devSessionOutput, onOpenURL}).finally(
    resolveBackgroundJob,
  )

  await Promise.all([
    backgroundJobPromise,
    renderDevSetupProgress()
      .then(serverStart)
      .then(() => {
        if (open) {
          openURLSafely(urls.local, 'development server')
        }
      }),
    renderPromise,
  ])
}

/**
 * Non-TTY / CI path: byte-for-byte identical to the previous behavior — readline
 * keypress handler, `renderDevReady` (which falls back to `renderLinks`), and the
 * background job resolved via the keypress handler's Ctrl-C.
 */
async function runNonInteractiveDevServer({
  themeName,
  urls,
  ctx,
  open,
  renderDevSetupProgress,
  serverStart,
  backgroundJobPromise,
  resolveBackgroundJob,
}: DevServerLifecycle) {
  readline.emitKeypressEvents(process.stdin)

  const keypressHandler = createKeypressHandler(urls, ctx, resolveBackgroundJob)
  process.stdin.on('keypress', keypressHandler)

  await Promise.all([
    backgroundJobPromise,
    renderDevSetupProgress()
      .then(serverStart)
      .then(async () => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true)
        }
        await renderDevReady(themeName, urls)
        if (open) {
          openURLSafely(urls.local, 'development server')
        }
      }),
  ])
}

/**
 * Mounts the persistent `ThemeDevUI` root with `exitOnCtrlC: false` so Ctrl-C is
 * handled by the view's abort lifecycle rather than by Ink tearing the tree down
 * mid-frame. Resolves once the tree unmounts.
 */
export async function renderThemeDevUI(props: {
  themeName: string
  urls: DevUrls
  abortController: AbortController
  devSessionOutput: DevSessionOutput
  onOpenURL: (key: 't' | 'p' | 'e' | 'g') => void
}): Promise<void> {
  await render(<ThemeDevUI {...props} />, {exitOnCtrlC: false})
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

function linkCell(label: string, url: string): TokenItem {
  return {link: {label, url}}
}

function styledDevReadyView(themeName: string, urls: DevUrls) {
  const rows: Cell[][] = [
    ['Local', linkCell(urls.local, urls.local)],
    ['Editor', linkCell('Open in Theme Editor', urls.themeEditor)],
    ['Preview', linkCell('Share theme preview', urls.preview)],
    ['Gift cards', linkCell('Preview gift cards', urls.giftCard)],
  ]

  return (
    <Panel
      title={`${themeName} · dev server`}
      footer="(t) localhost  (p) preview  (e) editor  (g) gift cards  ·  Ctrl-C to stop"
    >
      <Box>
        <Text color={palette.role}>● </Text>
        <Text color={palette.text}>running</Text>
      </Box>
      <StyledTable rows={rows} firstColumnSubdued />
    </Panel>
  )
}

export async function renderDevReady(themeName: string, urls: DevUrls): Promise<void> {
  await renderThemeView(styledDevReadyView(themeName, urls), () => renderLinks(urls))
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
