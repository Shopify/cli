
import {join} from 'node:path'

import {generateSchemaDocs} from '../../packages/app/dist/cli/services/docs/generate-schema-docs.js'

const clientId = process.argv[2]
if (!clientId) {
  console.error('Usage: node bin/docs/generate-schema-docs.js <client-id>')
  process.exit(1)
}

const basePath = join(process.cwd(), 'docs-shopify.dev/configuration')
await generateSchemaDocs(basePath, clientId)
