import {createServer} from 'node:http'
import type {IncomingMessage, ServerResponse} from 'node:http'

export async function loopbackServer(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const paths: string[] = []
  const server = createServer((request, response) => {
    paths.push(request.url ?? '/')
    handler(request, response)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a loopback TCP listener')
  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    paths,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    },
  }
}
