import {registerLiquidThemesTool} from './prompts/liquid_themes.js'
import {registerThemeA11yTool} from './prompts/theme_a11y.js'
import {registerThemeStandardsTool} from './prompts/theme_standards.js'
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

  registerLiquidThemesTool(server)
  registerThemeStandardsTool(server)
  registerThemeA11yTool(server)

  return server
}
