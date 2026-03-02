import {createServer} from './server.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'

const server = createServer()
const transport = new StdioServerTransport()
await server.connect(transport)

const shutdown = () => {
  const _closing = server
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
