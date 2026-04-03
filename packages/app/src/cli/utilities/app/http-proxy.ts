import * as http from 'http'
import * as https from 'https'
import * as net from 'net'

export interface ProxyServer {
  web(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    options: {target: string},
    callback?: (err: Error) => void,
  ): void
  ws(
    req: http.IncomingMessage,
    socket: net.Socket,
    head: Buffer,
    options: {target: string},
    callback?: (err: Error) => void,
  ): void
}

/**
 * Creates a lightweight reverse proxy server that supports HTTP and WebSocket forwarding.
 *
 * @returns A proxy server with web() and ws() methods.
 */
export function createProxyServer(): ProxyServer {
  return {web, ws}
}

function web(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: {target: string},
  callback?: (err: Error) => void,
): void {
  const target = new URL(options.target)
  const isSecure = target.protocol === 'https:'

  const outgoing: http.RequestOptions = {
    hostname: target.hostname,
    port: target.port || (isSecure ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: {...req.headers, connection: 'close'},
    agent: false,
  }

  const transport = isSecure ? https : http
  const proxyReq = transport.request(outgoing, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    if (callback) {
      callback(err)
    }
    if (!res.headersSent) {
      res.writeHead(502)
    }
    res.end()
  })

  req.pipe(proxyReq)
}

function ws(
  req: http.IncomingMessage,
  socket: net.Socket,
  head: Buffer,
  options: {target: string},
  callback?: (err: Error) => void,
): void {
  const target = new URL(options.target)
  const isSecure = target.protocol === 'https:'

  socket.setTimeout(0)
  socket.setNoDelay(true)
  socket.setKeepAlive(true, 0)

  if (head && head.length) {
    socket.unshift(head)
  }

  const outgoing: http.RequestOptions = {
    hostname: target.hostname,
    port: target.port || (isSecure ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: {...req.headers},
    agent: false,
  }

  const transport = isSecure ? https : http
  const proxyReq = transport.request(outgoing)

  proxyReq.on('error', (err) => {
    if (callback) {
      callback(err)
    }
    socket.end()
  })

  proxyReq.on('response', (proxyRes) => {
    if (!(proxyRes as http.IncomingMessage & {upgrade?: boolean}).upgrade) {
      const headers = Object.entries(proxyRes.headers)
        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
        .join('\r\n')
      socket.write(
        `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n${headers}\r\n\r\n`,
      )
      proxyRes.pipe(socket)
    }
  })

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    proxySocket.on('error', (err) => {
      if (callback) {
        callback(err)
      }
      socket.end()
    })

    socket.on('error', () => {
      proxySocket.destroy()
    })

    proxySocket.setTimeout(0)
    proxySocket.setNoDelay(true)
    proxySocket.setKeepAlive(true, 0)

    if (proxyHead && proxyHead.length) {
      proxySocket.unshift(proxyHead)
    }

    const headers = Object.entries(proxyRes.headers)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join('\r\n')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`)

    proxySocket.pipe(socket).pipe(proxySocket)
  })

  proxyReq.end()
}
