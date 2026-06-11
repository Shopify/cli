import {createDevelopmentExtensionServer} from './theme-ext-server.js'
import {DevServerContext} from '../theme-environment/types.js'
import {emptyThemeExtFileSystem, emptyThemeFileSystem} from '../theme-fs-empty.js'

import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {describe, expect, test} from 'vitest'
import {createEvent} from 'h3'

import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

describe('createDevelopmentExtensionServer', () => {
  const decoder = new TextDecoder()

  const createH3Event = (options: {url: string; headers?: Record<string, string>}) => {
    const req = new IncomingMessage(new Socket())
    req.url = options.url
    if (options.headers) req.headers = options.headers
    const res = new ServerResponse(req)
    return createEvent(req, res)
  }

  const dispatchEvent = async (
    server: ReturnType<typeof createDevelopmentExtensionServer>,
    url: string,
    headers?: Record<string, string>,
  ): Promise<{res: ServerResponse; status: number; body: string | Buffer}> => {
    const event = createH3Event({url, headers})
    const {res} = event.node
    let body = ''
    const resWrite = res.write.bind(res)
    res.write = (chunk) => {
      body ??= ''
      body += decoder.decode(chunk)
      return resWrite(chunk)
    }
    const resEnd = res.end.bind(res)
    res.end = (content) => {
      if (!body) body = content ?? ''
      return resEnd(content)
    }

    await server.dispatch(event)

    if (!body && '_data' in res) {
      // eslint-disable-next-line require-atomic-updates
      body = await new Response(res._data as ReadableStream).text()
    }

    return {res, status: res.statusCode, body}
  }

  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!

  const defaultServerContext: DevServerContext = {
    session: {
      storefrontToken: 'shptka_test_token_123',
      token: '',
      storeFqdn: 'my-store.myshopify.com',
      sessionCookies: {_shopify_essential: 'test-cookie-value'},
    },
    lastRequestedPath: '',
    localThemeFileSystem: emptyThemeFileSystem(),
    localThemeExtensionFileSystem: emptyThemeExtFileSystem(),
    directory: 'tmp',
    type: 'theme-extension',
    options: {
      ignore: [],
      only: [],
      noDelete: false,
      host: '127.0.0.1',
      port: 9293,
      liveReload: 'hot-reload',
      open: false,
      themeEditorSync: false,
      errorOverlay: 'default',
    },
  }

  describe('DNS rebinding protection', () => {
    const context = {...defaultServerContext}
    const server = createDevelopmentExtensionServer(developmentTheme, context)

    test.each([
      ['localhost:9293', 'localhost variant'],
      ['127.0.0.1:9293', 'IPv4 loopback'],
      ['[::1]:9293', 'IPv6 loopback'],
      ['LOCALHOST:9293', 'case insensitive'],
      ['localhost.:9293', 'trailing dot with port'],
    ])('accepts %s (%s)', async (host) => {
      const response = await dispatchEvent(server, '/wpm@something', {host})
      expect(response.status).not.toBe(400)
      expect(response.status).toBe(204)
    })

    test.each([
      ['attacker.com:9293', 'attacker domain'],
      ['poc.mzero.cloud:9293', 'DNS rebinding domain'],
      ['localhost:1234', 'wrong port'],
    ])('rejects %s (%s)', async (host) => {
      const response = await dispatchEvent(server, '/', {host})
      expect(response.status).toBe(400)
    })

    test('rejects requests with missing Host header', async () => {
      const response = await dispatchEvent(server, '/')
      expect(response.status).toBe(400)
    })

    test('accepts requests when --host flag is uppercase (LOCALHOST)', async () => {
      const uppercaseHostContext = {
        ...defaultServerContext,
        options: {...defaultServerContext.options, host: 'LOCALHOST'},
      }
      const uppercaseServer = createDevelopmentExtensionServer(developmentTheme, uppercaseHostContext)
      const response = await dispatchEvent(uppercaseServer, '/wpm@something', {host: 'localhost:9293'})
      expect(response.status).not.toBe(400)
      expect(response.status).toBe(204)
    })
  })
})
