import {SessionManager} from './session-manager.js'
import {registerAuthTool} from './tools/auth.js'
import {registerGraphqlTool} from './tools/graphql.js'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'

import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const {version} = require('../package.json') as {version: string}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'shopify',
    version,
  })

  const sessionManager = new SessionManager()

  registerAuthTool(server, sessionManager)
  registerGraphqlTool(server, sessionManager)

  return server
}
