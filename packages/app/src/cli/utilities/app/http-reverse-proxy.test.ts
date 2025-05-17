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
  const agent = protocol === 'http' ? undefined : new https.Agent({rejectUnauthorized: false})

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
        wss.close()
        resolve()
      })
      ws.on('error', reject)
    })
  })

  test('closes the server when aborted', {retry: 2}, async ({ports, servers}) => {
    servers.abortController.abort()
    // Try the assertion immediately, and if it fails, wait and retry
    try {
      await expect(fetch(`${protocol}://localhost:${ports.proxyPort}/path1`, {agent})).rejects.toThrow()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // If the assertion fails, wait a bit and try again
      await new Promise((resolve) => setTimeout(resolve, 100))
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

      targetServer1.listen(ports.targetPort1)
      targetServer2.listen(ports.targetPort2)

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

      proxyServer.listen(ports.proxyPort)
      await use({targetServer1, targetServer2, proxyServer, abortController})

      proxyServer.close()
      targetServer1.close()
      targetServer2.close()
    },
  })
}

const localhostCert = {
  key:
    '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC4f3TBaM5/O2KI\n' +
    'n9FIlwJ+g/6Tm9GPOF/Lme21lvIgXSRi0zr1hkhTmbHiQ6R9sdlrtYP+F63sK9lI\n' +
    'BeUzwc0SWt4CWEU/gd41SrDDl6hp2NY0H/oucmDVpq0nH7e/57vwNBvMeWS83rJ5\n' +
    'm3TqwEzzXnYwZOq/2nqpnKHZHizzhLa4vBYpVRGXaE61ldtZai+knSizx6I10FyC\n' +
    'eLZblCT0zNFaM6ObJjbpZEvx6BAig9lZreEVY4QxqIWZfXOICnQMyLhajIh1PW8K\n' +
    'UhLLKf6xTfZOx1O9gr8PdVrkNq+7FvglrwyBV0Eb2/NcL8T8EeFAoYt4kLAfxfwT\n' +
    'eXhaOuKDAgMBAAECggEBAKHtA10Ijkvuo+FDWxw5pS/CyzlkBX2Mvc7lD1NT4rfy\n' +
    '549w0otQysPM3em28nR7FlbJHcpxn+zq4y2qNurBCio05CrsrAI8Cfl9zzwrK92S\n' +
    'ORXQhvQi4MhDHC99T/k2+qSsJ0XDuV1mmv/OJ8Qs+JyUaGi6+aleqE+asBXtvQgQ\n' +
    'EWJHLLmGwzlnIj2Nc9qmH06QGOjoXOn3o4xLLz09CxEo987HzZv+Kw2Fci+XfEoj\n' +
    'OcezlrW5QbVR60aWJUrQu/Mmljpqsw8pQeKn9iWlyK8G+AvdvYgRjhcvEjVZcD0f\n' +
    'ue+C2MvVT1QCOiQtl3DDuFk2sy/YlakRT0/bxzPv/uECgYEA5p7IcsAnpohNicyq\n' +
    'wUJazFMuvGpUk6HiwnNFKZhNJXGkWTgNN6eZ9eEHGuYeTNdLTK65cHiQ3Q+ChhMz\n' +
    'rVnia4dPV6gLY15PjXbffRXJTPUetXcVW3nupdzSU7EO3o4ayhQ96/tzxUsvSPQE\n' +
    'd1PV5HS6ZbzSVwLLZLlXRdoEAlMCgYEAzM1G5u3pu6bPRN+XT6iFxbzmknOgppcT\n' +
    'pyvkTFrTtKn49m18AuywuQ+EvwzN6nh5LbLyWKKgcUuM75EI5ZNjM7UCfAG8eHum\n' +
    '1HXLEfJ6LpZJ0/80fUUHcAzL1bp3prRhTLbxOKtjx2ZnDlURY3tZKCoY7mHKmT/X\n' +
    'Y5AdopD8+RECgYEAkULyf1UJpJu2O1XvOEvTZV//0C4pl9QgQNradZi4/xzVqFzl\n' +
    '9mhbUcSr9QV9kGkLxQFJTM6kcJmUXV867bXwKErSbyQqCC0fbruxidhvM0oyTZr0\n' +
    'mOn0qASvdofQFd7sgNy/JCT+hwcUgZ8yMPddgskDn5GP676W3prfnd/1JoECgYAf\n' +
    '+yZJRXmsXf4b6TZ9r/lDyZ3P3NKHcSwWfNonuj85BRnlkW8+HavzGiNGmj9FkA6M\n' +
    'Pldt0+duCbg2aNWU1BE3r9p1dufxgI2qu8I8STsfL0TUIBQYQ8FHlBf4hifNFnnj\n' +
    'OuYsTUdFig4pxMr0V/yyMvC1uPukNr3xxD18d1upoQKBgQCOqyzwuXXZp0gDTuOC\n' +
    'c5hyjAhwxpppLvXt0bHZJ8AqSnRDFjMBjY+4s9hgaRFMjbcB4n0DZNQFKeECtcfm\n' +
    'gZGMPEvoMptrUbG4licNClEhgZJ1BDb5zQv0no2m9AAr5XYVCbAVyQAhhLfYZNMo\n' +
    'CIgUuvwT3ewgoTn8UsPOsgkmRA==\n' +
    '-----END PRIVATE KEY-----\n',
  cert:
    '-----BEGIN CERTIFICATE-----\n' +
    'MIIEVDCCArygAwIBAgIQIbaylXp1Twug/Ne2DltDXDANBgkqhkiG9w0BAQsFADCB\n' +
    'jTEeMBwGA1UEChMVbWtjZXJ0IGRldmVsb3BtZW50IENBMTEwLwYDVQQLDChyaWNo\n' +
    'YXJkcG93ZWxsQFJpY2hhcmRzLU1hY0Jvb2stUHJvLmxvY2FsMTgwNgYDVQQDDC9t\n' +
    'a2NlcnQgcmljaGFyZHBvd2VsbEBSaWNoYXJkcy1NYWNCb29rLVByby5sb2NhbDAe\n' +
    'Fw0yNTAzMDQxOTAyMTJaFw0yNzA2MDQxODAyMTJaMF4xJzAlBgNVBAoTHm1rY2Vy\n' +
    'dCBkZXZlbG9wbWVudCBjZXJ0aWZpY2F0ZTEzMDEGA1UECwwqcmljaGFyZHBvd2Vs\n' +
    'bEBSaWNoYXJkcy1NYWNCb29rLVByby0yLmxvY2FsMIIBIjANBgkqhkiG9w0BAQEF\n' +
    'AAOCAQ8AMIIBCgKCAQEAuH90wWjOfztiiJ/RSJcCfoP+k5vRjzhfy5nttZbyIF0k\n' +
    'YtM69YZIU5mx4kOkfbHZa7WD/het7CvZSAXlM8HNElreAlhFP4HeNUqww5eoadjW\n' +
    'NB/6LnJg1aatJx+3v+e78DQbzHlkvN6yeZt06sBM8152MGTqv9p6qZyh2R4s84S2\n' +
    'uLwWKVURl2hOtZXbWWovpJ0os8eiNdBcgni2W5Qk9MzRWjOjmyY26WRL8egQIoPZ\n' +
    'Wa3hFWOEMaiFmX1ziAp0DMi4WoyIdT1vClISyyn+sU32TsdTvYK/D3Va5Davuxb4\n' +
    'Ja8MgVdBG9vzXC/E/BHhQKGLeJCwH8X8E3l4WjrigwIDAQABo14wXDAOBgNVHQ8B\n' +
    'Af8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwHwYDVR0jBBgwFoAUpeI4lDvc\n' +
    'Yw09VrPC4ME+I0EjA0AwFAYDVR0RBA0wC4IJbG9jYWxob3N0MA0GCSqGSIb3DQEB\n' +
    'CwUAA4IBgQBhqZUbVSIVboIXxa3OFKctXi7PqsRId8D7KibIpEUjBegvgzIxpuqB\n' +
    '+5p7HZc7IZxEz7pD5wm7CCcw8CwnBSQOem+3YkrJtNzeTv+Le/YFWYYeCBb+38gR\n' +
    '9IAJT4BQXJr5vmBSYsqG0q9UXKXsLkA8FOscr2r6B+h3lF1e+NZlMHcMOFu9NJPO\n' +
    'n6suL6ap9jdtslqWCspkUy9xKMmya3lv7FbXKe48IyhazxVNUemZrEW/m6GZkCFx\n' +
    'IZnwtN9JV33IkE7w/+HHdomCCDpKsvGtX+KJxajnNaCawyP1k3+cMRQWPyp1ceUe\n' +
    'hMDQsOoGSZAVQGT7uCaUXcmphQedlJqhrFbqV2xUoU+XS+ASti3LdoQiRO8COAAV\n' +
    '4jT234BS7zHSJXcg+dmocKqOeRf5J5b+XwAkQs+qEgWSgHYsju5srNle4wd341PY\n' +
    'fbw6iqA335rMbN/+jBGZ2ixrrro7lc3RKI0oayLHT1QnszQdZy+SAfV3a++nwbkC\n' +
    'Sad3b/7iWHY=\n' +
    '-----END CERTIFICATE-----\n',
  certPath: 'localhost.pem',
}
