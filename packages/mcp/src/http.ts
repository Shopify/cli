import {createServer} from './server.js'
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {createServer as createHttpServer, type IncomingMessage, type ServerResponse} from 'node:http'
import {randomUUID} from 'node:crypto'

const server = createServer()
const transports = new Map<string, StreamableHTTPServerTransport>()

const PORT = parseInt(process.env.PORT || '3000', 10)

function isInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some(
      (msg) => typeof msg === 'object' && msg !== null && 'method' in msg && msg.method === 'initialize',
    )
  }
  return typeof body === 'object' && body !== null && 'method' in body && (body as {method: string}).method === 'initialize'
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function handlePost(req: IncomingMessage, res: ServerResponse) {
  const rawBody = await readBody(req)
  const body = JSON.parse(rawBody) as unknown
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId)!.handleRequest(req, res, body)
    return
  }

  if (!sessionId && isInitializeRequest(body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport)
      },
    })

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId)
      }
    }

    await server.connect(transport)
    await transport.handleRequest(req, res, body)
    return
  }

  res.writeHead(400, {'Content-Type': 'application/json'})
  res.end(JSON.stringify({jsonrpc: '2.0', error: {code: -32600, message: 'Bad request: missing or invalid session'}, id: null}))
}

async function handleGet(req: IncomingMessage, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({jsonrpc: '2.0', error: {code: -32600, message: 'Invalid or missing session'}, id: null}))
    return
  }
  await transports.get(sessionId)!.handleRequest(req, res)
}

async function handleDelete(req: IncomingMessage, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({jsonrpc: '2.0', error: {code: -32600, message: 'Invalid or missing session'}, id: null}))
    return
  }
  await transports.get(sessionId)!.handleRequest(req, res)
}

const httpServer = createHttpServer(async (req, res) => {
  if (req.url !== '/mcp') {
    res.writeHead(404, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: 'Not found'}))
    return
  }

  try {
    if (req.method === 'POST') {
      await handlePost(req, res)
    } else if (req.method === 'GET') {
      await handleGet(req, res)
    } else if (req.method === 'DELETE') {
      await handleDelete(req, res)
    } else {
      res.writeHead(405, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({error: 'Method not allowed'}))
    }
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({jsonrpc: '2.0', error: {code: -32603, message: 'Internal server error'}, id: null}))
    }
  }
})

httpServer.listen(PORT, () => {
  console.error(`Shopify MCP server (HTTP) listening on http://localhost:${PORT}/mcp`)
})

const shutdown = () => {
  httpServer.close()
  const _closing = server
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
