
import {join} from 'node:path'

import {generateSchemaDocs} from '../../packages/app/dist/cli/services/docs/generate-schema-docs.js'

const basePath = join(process.cwd(), 'docs-shopify.dev/configuration')
await generateSchemaDocs(basePath)
