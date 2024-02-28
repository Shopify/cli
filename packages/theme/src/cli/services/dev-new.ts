/* eslint-disable @typescript-eslint/no-explicit-any */
import {outputInfo} from '@shopify/cli-kit/node/output'
import {H3Event, createApp, defineEventHandler, getRequestIP, sendWebResponse, toNodeListener} from 'h3'
import {createServer} from 'http'

interface ServerOptions {
  theme?: string
  host?: string
  port?: string
}

export function startDevServer(options: ServerOptions) {
  startServer(options)
  startWatcher()
}

const SESSION_COOKIE_NAME = '_secure_session_id'
const SESSION_COOKIE_REGEXP = new RegExp(`${SESSION_COOKIE_NAME}=(\\w+)`)

// 1 -  proxy requests to the live theme DONE
// 2 - proxy reqeusts to an unpublished theme (preview theme id) -> something is wrong with the secure session id at the moment
// 3 - sync files
// 3 - watch for file changes and reload the server
// 4 - local assets, fonts, etc
// 5 - Tests
// 6 - Edge Cases
// 7 - Logging
// 8 - Error Handling
// 9 - Polish

function startServer(options: ServerOptions) {
  const httpApp = createApp()

  httpApp.use(
    '/test',
    defineEventHandler(async (event: H3Event) => {
      await handleProxy(event, options)
    }),
  )

  const httpServer = createServer(toNodeListener(httpApp))

  const port = options.port || '9292'
  const host = options.host || '127.0.0.1'

  httpServer.listen(parseInt(port, 10), host)

  process.on('SIGABRT', () => {
    httpServer.close()
  })
}

async function handleProxy(event: H3Event, options: ServerOptions) {
  const sessionId = await getSecureSessionId(options)

  outputInfo(sessionId)

  const cookies = configureCookies(event.node.req.headers.cookie, sessionId)
  await cleanSfrCache(event, sessionId, options.theme, cookies)
  const result = await fetch(`https://mammoth-matcha.myshopify.com`, {
    method: event.node.req.method,
    headers: {
      Host: 'mammoth-matcha.myshopify.com',
      'User-Agent': 'Shopify CLI',
      Cookie: `${cookies};`,
      'X-Forwarded-For': getRequestIP(event),
      'Accept-Encoding': 'none',
    } as any,
  })
  return sendWebResponse(event, result)
}

// no need to replace if the value is alreday the correct value
export function configureCookies(cookies: string | undefined, sessionId: string): string {
  if (!cookies) {
    return `_secure_session_id=${sessionId}`
  }

  if (cookies.includes('_secure_session_id')) {
    return cookies.replace(SESSION_COOKIE_REGEXP, `_secure_session_id=${sessionId}`)
  } else {
    return `${cookies}; _secure_session_id=${sessionId}`
  }
}

async function cleanSfrCache(event: H3Event, secureSessionId: string, theme = '140324634868', cookies: string) {
  outputInfo(theme)
  await fetch(`https://mammoth-matcha.myshopify.com/?preview_theme_id=${theme}&_fd=0&pb=0`, {
    method: event.node.req.method,
    headers: {
      Host: 'mammoth-matcha.myshopify.com',
      'User-Agent': 'Shopify CLI',
      Cookie: cookies,
      'X-Forwarded-For': getRequestIP(event),
      'Accept-Encoding': 'none',
    } as any,
  })
}

async function getSecureSessionId(options: ServerOptions) {
  const themeId = options.theme ? options.theme : '140324634868'
  outputInfo(themeId)
  const response = await fetch(`https://mammoth-matcha.myshopify.com/?preview_theme_id=${themeId}&_fd=0&pb=0`, {
    method: 'HEAD',
  })
  const responseHeaderSetCookie: string[] = response.headers.getSetCookie()
  return extractSecureSessionIdFromResponseHeaders(responseHeaderSetCookie)
}

export function extractSecureSessionIdFromResponseHeaders(cookie: string[]) {
  const secureSessionIdCookie = cookie.find((cookie) => SESSION_COOKIE_REGEXP.test(cookie))
  const match = secureSessionIdCookie?.match(SESSION_COOKIE_REGEXP)?.[1]
  return match || ''
}
function startWatcher() {}
