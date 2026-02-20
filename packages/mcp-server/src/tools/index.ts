import {registerAuthLogin} from './auth-login.js'
import {registerCliHelp} from './cli-help.js'
import {registerCliRun} from './cli-run.js'
import type {McpServerConfig} from '../config.js'
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerAllTools(server: McpServer, config: McpServerConfig): void {
  registerAuthLogin(server, config)
  registerCliHelp(server, config)
  registerCliRun(server, config)
}
