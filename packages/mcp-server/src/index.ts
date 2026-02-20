import {resolveConfig} from './config.js'
import {registerAllTools} from './tools/index.js'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)
const {version} = require('../package.json') as {version: string}

const config = resolveConfig()
const server = new McpServer({name: 'shopify-cli', version})

registerAllTools(server, config)

const transport = new StdioServerTransport()
await server.connect(transport)
