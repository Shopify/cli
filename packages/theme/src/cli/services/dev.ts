import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {currentDirectoryConfirmed} from '../utilities/theme-ui.js'
import {DevServerSession} from '../utilities/theme-environment/types.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AdminSession, ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {consoleLog, outputDebug, outputInfo} from '@shopify/cli-kit/node/output'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {createApp, getQuery, IncomingMessage, ServerResponse} from 'h3'
import {readFile} from '@shopify/cli-kit/node/fs'
import {createServer} from 'http'

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

  const session: DevServerSession = {
    ...options.adminSession,
    storefrontToken: options.storefrontToken,
    storefrontPassword: 'zelda',
    expiresAt: new Date(),
  }

  await setupHTTPServer(9292, session)
}

async function setupHTTPServer(port: number, session: DevServerSession) {
  // State
  const clients = new Set<ServerResponse>()

  // ===========================================================================
  // Setup file system events
  const {default: chokidar} = await import('chokidar')

  const watchPaths = ['/Users/karreiro/src/github.com/Shopify/dawn']
  const watcher = chokidar.watch(watchPaths, {
    ignored: ['**/node_modules/**', '**/.git/**', '**/*.test.*', '**/dist/**', '**/*.swp'],
    persistent: true,
    ignoreInitial: true,
  })

  watcher.on('all', (event, path) => {
    consoleLog(`→ sections/announcement-bar.liquid`)

    for (const client of clients) {
      client.write(`data: ${JSON.stringify({event, path})}\n\n`)
    }
  })

  // ===========================================================================
  // Setup development server
  const app = createApp({
    // eslint-disable-next-line node/handle-callback-err
    onError: (_err) => {},
  })

  app.use(async (req: IncomingMessage, res: ServerResponse) => {
    const path = req.url || '/'
    const params = getQuery(req)

    if (params.section_id) {
      const response = await render(session, {
        path: '/',
        query: [],
        themeId: '163574120470',
        cookies: '',
        sectionId: 'announcement-bar',
        headers: {},
        replaceTemplates: {
          'sections/announcement-bar.liquid': await readFile(
            '/Users/karreiro/src/github.com/Shopify/dawn/sections/announcement-bar.liquid',
          ),
        },
      })

      res.end(await response.text())
      return
    }

    if (path === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      clients.add(res)

      req.on('close', () => {
        res.end()
      })

      return
    }

    const response = await render(session, {
      path: '/',
      query: [],
      themeId: '163574120470',
      cookies: '',
      sectionId: '',
      headers: {},
      replaceTemplates: {
        'sections/announcement-bar.liquid': await readFile(
          '/Users/karreiro/src/github.com/Shopify/dawn/sections/announcement-bar.liquid',
        ),
      },
    })

    const hmr = `
        <script>
          (() => {
            console.log('[SSE client] Initializing...')

            function querySelectDOMSections(idSuffix) {
              const elements = document.querySelectorAll(
              \`[id^='shopify-section'][id$='\${idSuffix}']\`
              );
              return Array.from(elements);
            }

            function handleMessage(msg) {
              console.log('>>', msg);

              fetch('?section_id=announcement-bar')
                .then(response => response.text())
                .then(text => {
                  const elements = querySelectDOMSections("announcement-bar");

                  elements.forEach((element) => {
                    element.outerHTML = text;
                  });

                  console.log('>>', msg);
                })
                .catch(error => {
                  console.error('Error:', error);
                });
            }

            var e = new EventSource("/events")
            e.onmessage = (msg) => handleMessage(msg)
          })();
        </script>
      `

    res.end((await response.text()) + hmr)
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const server = createServer(app)

  server.listen(port, () => {
    consoleLog(`Server running on http://127.0.0.1:${port}`)
  })

  return server
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
