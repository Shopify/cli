import {createProxyServer} from './http-proxy.js'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {describe, test, expect, afterEach} from 'vitest'
import fetch from 'node-fetch'
import http from 'http'

const servers: http.Server[] = []

function listen(server: http.Server, port: number): Promise<void> {
  servers.push(server)
  return new Promise((resolve) => server.listen(port, 'localhost', resolve))
}

afterEach(async () => {
  const toClose = [...servers]
  servers.splice(0, servers.length)
  await Promise.all(
    toClose.map((server) => {
      server.closeAllConnections()
      return new Promise<void>((resolve) => server.close(() => resolve()))
    }),
  )
})

describe('createProxyServer', () => {
  describe('web', () => {
    test('forwards GET request and returns response', async () => {
      const targetPort = await getAvailableTCPPort()
      const proxyPort = await getAvailableTCPPort()

      const target = http.createServer((_req, res) => {
        res.writeHead(200, {'content-type': 'text/plain'})
        res.end('hello from target')
      })
      await listen(target, targetPort)

      const proxy = createProxyServer()
      const server = http.createServer((req, res) => {
        proxy.web(req, res, {target: `http://localhost:${targetPort}`})
      })
      await listen(server, proxyPort)

      const res = await fetch(`http://localhost:${proxyPort}/test`)
      expect(res.status).toBe(200)
      await expect(res.text()).resolves.toBe('hello from target')
    })

    test('forwards POST request with body', async () => {
      const targetPort = await getAvailableTCPPort()
      const proxyPort = await getAvailableTCPPort()

      const target = http.createServer((req, res) => {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          res.writeHead(200, {'content-type': 'text/plain'})
          res.end(`received: ${body}`)
        })
      })
      await listen(target, targetPort)

      const proxy = createProxyServer()
      const server = http.createServer((req, res) => {
        proxy.web(req, res, {target: `http://localhost:${targetPort}`})
      })
      await listen(server, proxyPort)

      const res = await fetch(`http://localhost:${proxyPort}/test`, {
        method: 'POST',
        body: 'test payload',
      })
      await expect(res.text()).resolves.toBe('received: test payload')
    })

    test('preserves response headers', async () => {
      const targetPort = await getAvailableTCPPort()
      const proxyPort = await getAvailableTCPPort()

      const target = http.createServer((_req, res) => {
        res.writeHead(200, {'x-custom-header': 'custom-value', 'content-type': 'text/plain'})
        res.end('ok')
      })
      await listen(target, targetPort)

      const proxy = createProxyServer()
      const server = http.createServer((req, res) => {
        proxy.web(req, res, {target: `http://localhost:${targetPort}`})
      })
      await listen(server, proxyPort)

      const res = await fetch(`http://localhost:${proxyPort}/`)
      expect(res.headers.get('x-custom-header')).toBe('custom-value')
    })

    test('calls error callback when target is unreachable', async () => {
      const proxyPort = await getAvailableTCPPort()
      const deadPort = await getAvailableTCPPort()

      const proxy = createProxyServer()
      const errors: Error[] = []
      const server = http.createServer((req, res) => {
        proxy.web(req, res, {target: `http://localhost:${deadPort}`}, (err) => {
          errors.push(err)
        })
      })
      await listen(server, proxyPort)

      const res = await fetch(`http://localhost:${proxyPort}/`)
      expect(res.status).toBe(502)
      expect(errors.length).toBe(1)
      expect((errors[0] as NodeJS.ErrnoException).code).toBe('ECONNREFUSED')
    })

    test('forwards request path to target', async () => {
      const targetPort = await getAvailableTCPPort()
      const proxyPort = await getAvailableTCPPort()

      const target = http.createServer((req, res) => {
        res.writeHead(200)
        res.end(req.url)
      })
      await listen(target, targetPort)

      const proxy = createProxyServer()
      const server = http.createServer((req, res) => {
        proxy.web(req, res, {target: `http://localhost:${targetPort}`})
      })
      await listen(server, proxyPort)

      const res = await fetch(`http://localhost:${proxyPort}/some/path?q=1`)
      await expect(res.text()).resolves.toBe('/some/path?q=1')
    })
  })

  describe('ws', () => {
    test('calls error callback when target is unreachable', async () => {
      const proxyPort = await getAvailableTCPPort()
      const deadPort = await getAvailableTCPPort()

      const proxy = createProxyServer()
      const errors: Error[] = []
      const server = http.createServer()
      server.on('upgrade', (req, socket, head) => {
        proxy.ws(req, socket as import('net').Socket, head, {target: `http://localhost:${deadPort}`}, (err) => {
          errors.push(err)
        })
      })
      await listen(server, proxyPort)

      await new Promise<void>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {WebSocket} = require('ws')
        const ws = new WebSocket(`ws://localhost:${proxyPort}`)
        ws.on('error', () => resolve())
        ws.on('open', () => resolve())
      })

      expect(errors.length).toBe(1)
      expect((errors[0] as NodeJS.ErrnoException).code).toBe('ECONNREFUSED')
    })
  })
})
