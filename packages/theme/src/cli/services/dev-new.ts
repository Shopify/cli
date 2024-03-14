/* eslint-disable @typescript-eslint/no-explicit-any */
import {outputInfo} from '@shopify/cli-kit/node/output'
import {H3Event, createApp, defineEventHandler, getRequestIP, sendWebResponse, toNodeListener, useSession} from 'h3'
import {randomUUID} from 'crypto'
import {createServer} from 'http'

// !! store secure session id + refresh only when needed (WIP)
// !! sync files
// !! watch for file changes and reload the server
// !! local assets, fonts, etc
// !! Tests
// !! Edge Cases
// !! Logging
// !! Error Handling
// !! Polish

const SESSION_COOKIE_NAME = '_secure_session_id'
const SESSION_COOKIE_REGEXP = new RegExp(`${SESSION_COOKIE_NAME}=(\\w+)`)
const DEFAULT_PORT = '9292'
const DEFAULT_HOST = '127.0.0.1'

interface ServerOptions {
  theme: string
  host?: string
  port?: string
  sessionPassword?: string
}

export function startDevServer(options: ServerOptions) {
  startServer(options)
  startWatcher()
}

function startServer(options: ServerOptions) {
  options.sessionPassword = randomUUID()
  const httpApp = createApp()

  httpApp.use(
    '/test',
    defineEventHandler(async (event: H3Event) => {
      await handleProxy(event, options)
    }),
  )

  const httpServer = createServer(toNodeListener(httpApp))
  const port = options.port || DEFAULT_PORT
  const host = options.host || DEFAULT_HOST

  httpServer.listen(parseInt(port, 10), host)

  process.on('SIGABRT', () => {
    httpServer.close()
  })
}

async function handleProxy(event: H3Event, options: ServerOptions) {
  const sessionId = await getSessionId(event, options)

  const cookies = configureCookies(event.node.req.headers.cookie, sessionId)
  await cleanSfrCache(event, options.theme, cookies)
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

async function cleanSfrCache(event: H3Event, theme: string, cookies: string) {
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

async function getSessionId(event: H3Event, options: ServerOptions) {
  const session = await useSession(event, {
    password: options.sessionPassword!,
  })
  const secureSessionId = session.data.secureSessionId
  if (secureSessionId) {
    // check if this is the expected secure session ID
    // if not, update it
    // if so, check if that session token is expired
    return secureSessionId
  } else {
    await session.update({
      secureSessionId: await fetchSecureSessionId(options),
    })
  }
  return session.data.secureSessionId
}

async function fetchSecureSessionId(options: ServerOptions) {
  outputInfo('Fetching secure session id')
  const response = await fetch(`https://mammoth-matcha.myshopify.com/?preview_theme_id=${options.theme}&_fd=0&pb=0`, {
    method: 'HEAD',
  })
  const responseHeaderSetCookie: string[] = response.headers.getSetCookie()
  return extractSecureSessionIdFromResponseHeaders(responseHeaderSetCookie)
}

export function extractSecureSessionIdFromResponseHeaders(cookie: string[]) {
  const secureSessionIdCookie = cookie.find((cookie) => SESSION_COOKIE_REGEXP.test(cookie))
  const match = secureSessionIdCookie?.match(SESSION_COOKIE_REGEXP)?.[1]
  if (!match) {
    throw new Error('Secure session ID not found in response headers')
  }
  return match
}

function startWatcher() {}
