import {getProxyingWebServer} from './http-reverse-proxy.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {describe, test, expect} from 'vitest'
import fetch from 'node-fetch'
import WebSocket, {WebSocketServer} from 'ws'
import http from 'http'
import https from 'https'

const each = ['http', 'https'] as const

describe.sequential.each(each)('http-reverse-proxy for %s', (protocol) => {
  const test = getTestReverseProxy(protocol)
  const wsProtocol = protocol === 'http' ? 'ws' : 'wss'
  const agent =
    protocol === 'http'
      ? new http.Agent({keepAlive: false})
      : new https.Agent({ca: localhostCert.cert, keepAlive: false})

  test('routes requests to the correct target based on path', {retry: 2}, async ({ports, servers}) => {
    const response1 = await fetch(`${protocol}://localhost:${ports.proxyPort}/path1/test`, {agent})
    await expect(response1.text()).resolves.toBe('Response from target server 1')

    const response2 = await fetch(`${protocol}://localhost:${ports.proxyPort}/path2/test`, {agent})
    await expect(response2.text()).resolves.toBe('Response from target server 2')
  })

  test('routes requests to the default target when no matching path is found', {retry: 2}, async ({ports, servers}) => {
    const response = await fetch(`${protocol}://localhost:${ports.proxyPort}/unknown/path`, {agent})
    await expect(response.text()).resolves.toBe('Response from target server 1')
  })

  test('handles websocket connections', {retry: 2}, async ({ports, servers}) => {
    return new Promise<void>((resolve, reject) => {
      const wss = new WebSocketServer({server: servers.targetServer1})
      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          ws.send(`Echo: ${String(message)}`)
        })
      })

      const ws = new WebSocket(`${wsProtocol}://localhost:${ports.proxyPort}/path1`, {agent})

      ws.on('open', () => {
        ws.send('Hello, WebSocket!')
      })
      ws.on('message', (data) => {
        expect(String(data)).toBe('Echo: Hello, WebSocket!')
        ws.close()
      })
      ws.on('close', () => {
        wss.close(() => resolve())
      })
      ws.on('error', reject)
    })
  })

  test('responds to CORS preflight OPTIONS with default headers', {retry: 2}, async ({ports, servers}) => {
    const response = await fetch(`${protocol}://localhost:${ports.proxyPort}/path1/test`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://extensions.shopifycdn.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
      agent,
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://extensions.shopifycdn.com')
    expect(response.headers.get('access-control-allow-methods')).toBe('GET')
    expect(response.headers.get('access-control-allow-headers')).toBe('Authorization')
    expect(response.headers.get('access-control-max-age')).toBe('86400')
  })

  test('responds to CORS preflight OPTIONS with defaults when no request headers', {retry: 2}, async ({ports, servers}) => {
    const response = await fetch(`${protocol}://localhost:${ports.proxyPort}/path1/test`, {
      method: 'OPTIONS',
      agent,
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type, Authorization')
  })

  test('closes the server when aborted', {retry: 2}, async ({ports, servers}) => {
    servers.abortController.abort()
    // Try the assertion immediately, and if it fails, wait and retry
    try {
      await expect(fetch(`${protocol}://localhost:${ports.proxyPort}/path1`, {agent})).rejects.toThrow()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // If the assertion fails, wait a bit and try again
      await new Promise((resolve) => setTimeout(resolve, 10))
      await expect(fetch(`${protocol}://localhost:${ports.proxyPort}/path1`, {agent})).rejects.toThrow()
    }
  })
})

function getTestReverseProxy(protocol: 'http' | 'https') {
  return test.extend<{
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
      const proxyPort = await getAvailableTCPPort()
      const targetPort1 = await getAvailableTCPPort()
      const targetPort2 = await getAvailableTCPPort()
      await use({proxyPort, targetPort1, targetPort2})
    },
    servers: async ({ports}, use) => {
      const targetServer1 = http.createServer((req, res) => {
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end('Response from target server 1')
      })

      const targetServer2 = http.createServer((req, res) => {
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end('Response from target server 2')
      })

      await new Promise<void>((resolve) => targetServer1.listen(ports.targetPort1, 'localhost', resolve))
      await new Promise<void>((resolve) => targetServer2.listen(ports.targetPort2, 'localhost', resolve))

      const abortController = new AbortController()
      const {server: proxyServer} = await getProxyingWebServer(
        {
          '/path1': `http://localhost:${ports.targetPort1}`,
          '/path2': `http://localhost:${ports.targetPort2}`,
          default: `http://localhost:${ports.targetPort1}`,
        },
        abortController.signal,
        protocol === 'https' ? localhostCert : undefined,
      )

      await new Promise<void>((resolve) => proxyServer.listen(ports.proxyPort, 'localhost', resolve))
      await use({targetServer1, targetServer2, proxyServer, abortController})

      proxyServer.closeAllConnections()
      await new Promise<void>((resolve) => proxyServer.close(() => resolve()))
      targetServer1.closeAllConnections()
      await new Promise<void>((resolve) => targetServer1.close(() => resolve()))
      targetServer2.closeAllConnections()
      await new Promise<void>((resolve) => targetServer2.close(() => resolve()))
    },
  })
}

const localhostCert = {
  key:
    '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCpAmXYsXgC0K9l\n' +
    'aAknNZPdxG2/sA4EC4+Ez7fe+nvMn3vmFE+loesu2IAOYrqJPJvN9vGGr0Vs3P1u\n' +
    '6zcDV7NSWSAvO8BT5InLnOFWIeF5clq7wc1mk4lrcM4fJtJocdnmRZxpbWaDTa7a\n' +
    '/seQliQrr5Skw7VWuFkp3lqOLu2XXXVcbZ7+Ya7wzMej9wXAfRwZO8dfg/pwhxfe\n' +
    'jwfxz/wKjfEewFAQ2vOdQKw6ju+sLnCDXCcnmlifYWlvoDnl06Q9jc7kz/rwr0d9\n' +
    '2nxJDx/G4XA8LfrBO257P4FMilwPwpb8OgrSoxQRqD89b7eOXcjsYqiZDOR4mEz2\n' +
    'gg0DqSmdAgMBAAECggEAR41uVPl9l6OGPmZ3SZRTT9ZzqG3+4ROL5WyTqeFePFlg\n' +
    '+R2sQrF0glbCkFSYKLXyOJbN1nmp6Nb+rNEEb3PXxYtaJuUjHeFpvTxj4jVh4irZ\n' +
    '4xe/wCfCTCxr96BWAEYDPIxIFhJtDjX7S1gGYV5PXfdt9PuucFKH3UP4Dq4rhKMq\n' +
    'L5DE70ipk93G66cKwMnfzlPpjnKDMesq+GNLTotzOl0n7v7N2rwgZlbEoHznOFcn\n' +
    'zA510COtiWksL3LVORnEYdMzUWlPxWM+t3ONDZlXByC0qJEf3toiNwzYi2wpLqUP\n' +
    'iq5sKALCG+CJzTp2myH3Tb8Zsx49mP/scDJE0rCueQKBgQDdT36ZrBmi3/YWAgqt\n' +
    'RG2FQugN4Ec//WzTWpqhldy9rZBJEiOiMKdBXGn3R6llv7Ft18ZR/EFq7ID84Gva\n' +
    'XcTGDEZlehW9u3b83z3qIfntfUpMNNt8v/aaKrSD7e861PGpqePJXbgg1p7ls7vt\n' +
    'Gjf9bHhm9rmtXQ8pijzpVMVXEwKBgQDDgDhLIQinGps2VYcW9YzmF2nsvOzikA1c\n' +
    'V67ogq0ftt9V0iCXt8V3JMd5Xt7ALtLj0uzI8qVKXDbcti/Fq4jGIia4hQ3lA5cQ\n' +
    '0WkZvEqAbpwbSd28P10RIAnSWlY4ZkCj9FZNpnS4TdDZa4wns3R5lsZVUlAbyRd0\n' +
    'NaRwt08ijwKBgQDIx3Mi9dj4RFmdE9Md6OO3r8CZvizF6CQQB7Yb/LscNledg2Bi\n' +
    'p+NF0BKu7gvILMZK0iSxgrrSx6gqQ2x12vZHeyFutPj+fhHwTpR8UsDM7gs24gly\n' +
    'vzF6Il5NBtMwO7rXYzMuH+GJoUzdNle7Pzsmpn8BYruHhdLYq/qg8XBrkwKBgHhW\n' +
    'MFBuYPka83caZjDHrJbkypqiH93FdbPldRBBf3cKBaa51L4OrEmOJgqbTtlU+RKq\n' +
    '/n0ifoOrB0oMCpPN5j6vPs5NeCQDdbUwcVUaBXHQo95YNVhuWEb2RZVpbbEBn8BL\n' +
    '4eOiFi5sF6X9ASRe3c8J88MJC65OtVUev71x2BAZAoGBAKCMcgjTJwS7avupT3D/\n' +
    '/ZY2Nz4+Ro7xv3OrquEDPGF9IOjxUph7yedwtX/Ybwnh/Wu6HYmJnK5S4zsijgp9\n' +
    'CNEakriug3FXzamyXzGQFlVXrz5/RGqraGFeElrqt4hv1iPe1aiVGFLSc//4cLrA\n' +
    'jZPjgaaFbRALJQJ6i5luC2LP\n' +
    '-----END PRIVATE KEY-----\n',
  cert:
    '-----BEGIN CERTIFICATE-----\n' +
    'MIICwzCCAaugAwIBAgIJALZpjza1rNWnMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNV\n' +
    'BAMMCWxvY2FsaG9zdDAeFw0yNjAzMjYxODQzMjhaFw0zNjAzMjMxODQzMjhaMBQx\n' +
    'EjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\n' +
    'ggEBAKkCZdixeALQr2VoCSc1k93Ebb+wDgQLj4TPt976e8yfe+YUT6Wh6y7YgA5i\n' +
    'uok8m8328YavRWzc/W7rNwNXs1JZIC87wFPkicuc4VYh4XlyWrvBzWaTiWtwzh8m\n' +
    '0mhx2eZFnGltZoNNrtr+x5CWJCuvlKTDtVa4WSneWo4u7ZdddVxtnv5hrvDMx6P3\n' +
    'BcB9HBk7x1+D+nCHF96PB/HP/AqN8R7AUBDa851ArDqO76wucINcJyeaWJ9haW+g\n' +
    'OeXTpD2NzuTP+vCvR33afEkPH8bhcDwt+sE7bns/gUyKXA/Clvw6CtKjFBGoPz1v\n' +
    't45dyOxiqJkM5HiYTPaCDQOpKZ0CAwEAAaMYMBYwFAYDVR0RBA0wC4IJbG9jYWxo\n' +
    'b3N0MA0GCSqGSIb3DQEBCwUAA4IBAQB2vd2s4NKoApN57AN507SEO7eU1sJLl0xG\n' +
    'I1NCel8sSSjO6gkjx3HOxX5hPekjPVoPDA/o4KDUfJG16wGkiow7A9HL9LVcG5J5\n' +
    'pSFSS885joDu79uZfEPixbo7SGjAKG0SnJ5WbXz9JDIDenO8zuMCPKIE1hchsEpV\n' +
    '2MQ4f2tKK7qS1MI67Uu/U2I+2v32GB4PvGVSmpDbk09larAi/rnJM32cLIM5QamF\n' +
    'XsgFQapfZCLV9TJo3nAm7Z0BoQN707YrJZDiky4kVQXk2jog+Qr7v+h9pTh5lOob\n' +
    'Kr3LCBfGnbLLYljudOKEyx1ZyVB7Lv7kgAtQ8FmgycN327xsrxVj\n' +
    '-----END CERTIFICATE-----\n',
  certPath: 'localhost.pem',
}
