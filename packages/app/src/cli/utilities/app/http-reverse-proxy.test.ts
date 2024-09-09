import {getProxyingWebServer} from './http-reverse-proxy.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {describe, test, expect} from 'vitest'
import fetch from 'node-fetch'
import WebSocket, {WebSocketServer} from 'ws'
import http from 'http'

const testWithServers = test.extend<{
  ports: {
    proxyPort: number
    targetPort1: number
    targetPort2: number
  }
  servers: {
    targetServer1: http.Server
    targetServer2: http.Server
    proxyServer: http.Server
    abortController: AbortController
  }
}>({
  // eslint-disable-next-line no-empty-pattern
  ports: async ({}, use) => {
    const [proxyPort, targetPort1, targetPort2] = await Promise.all([
      getAvailableTCPPort(),
      getAvailableTCPPort(),
      getAvailableTCPPort(),
    ])
    await use({proxyPort, targetPort1, targetPort2})
  },
  servers: async ({ports}, use) => {
    const targetServer1 = http.createServer((req, res) => {
      res.writeHead(200, {'Content-Type': 'text/plain'})
      res.end('Response from target server 1')
    })
    await new Promise<void>((resolve) => targetServer1.listen(ports.targetPort1, resolve))

    const targetServer2 = http.createServer((req, res) => {
      res.writeHead(200, {'Content-Type': 'text/plain'})
      res.end('Response from target server 2')
    })
    await new Promise<void>((resolve) => targetServer2.listen(ports.targetPort2, resolve))

    const rules = {
      '/path1': `http://localhost:${ports.targetPort1}`,
      '/path2': `http://localhost:${ports.targetPort2}`,
      default: `http://localhost:${ports.targetPort1}`,
    }
    const abortController = new AbortController()
    const {server: proxyServer} = await getProxyingWebServer(rules, abortController.signal)
    await new Promise<void>((resolve) => proxyServer.listen(ports.proxyPort, resolve))

    await use({targetServer1, targetServer2, proxyServer, abortController})

    proxyServer.close()
    targetServer1.close()
    targetServer2.close()
  },
})

describe('http-reverse-proxy', () => {
  testWithServers('routes requests to the correct target based on path', async ({ports, servers}) => {
    const response1 = await fetch(`http://localhost:${ports.proxyPort}/path1/test`)
    await expect(response1.text()).resolves.toBe('Response from target server 1')

    const response2 = await fetch(`http://localhost:${ports.proxyPort}/path2/test`)
    await expect(response2.text()).resolves.toBe('Response from target server 2')
  })

  testWithServers('routes requests to the default target when no matching path is found', async ({ports, servers}) => {
    const response = await fetch(`http://localhost:${ports.proxyPort}/unknown/path`)
    await expect(response.text()).resolves.toBe('Response from target server 1')
  })

  testWithServers('handles websocket connections', async ({ports, servers}) => {
    return new Promise<void>((resolve, reject) => {
      const wss = new WebSocketServer({server: servers.targetServer1})
      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          ws.send(`Echo: ${message}`)
        })
      })

      const ws = new WebSocket(`ws://localhost:${ports.proxyPort}/path1`)
      ws.on('open', () => {
        ws.send('Hello, WebSocket!')
      })
      ws.on('message', (data) => {
        expect(data.toString()).toBe('Echo: Hello, WebSocket!')
        ws.close()
        wss.close()
        resolve()
      })
      ws.on('error', reject)
    })
  })

  testWithServers('closes the server when aborted', async ({ports, servers}) => {
    servers.abortController.abort()
    // Try the assertion immediately, and if it fails, wait and retry
    try {
      await expect(fetch(`http://localhost:${ports.proxyPort}/path1`)).rejects.toThrow()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // If the assertion fails, wait a bit and try again
      await new Promise((resolve) => setTimeout(resolve, 100))
      await expect(fetch(`http://localhost:${ports.proxyPort}/path1`)).rejects.toThrow()
    }
  })
})
