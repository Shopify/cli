import glob from 'fast-glob'
import {fileURLToPath} from 'url'
import path from 'node:path'
import {Application as TypeDocApp} from 'typedoc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const cliKitRoot = path.join(__dirname, '..')
  const entryPoints = (await glob('src/public/**/*.(ts|tsx)', {cwd: cliKitRoot}))
    .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))

  const app = await TypeDocApp.bootstrapWithPlugins({
    excludeExternals: true,
    entryPoints,
    readme: 'none',
  })

  const project = await app.convert()
  // Project may not have converted correctly
  if (project) {
    const outputDir = path.join(__dirname, '../../../docs/api/cli-kit')
    await app.generateDocs(project, outputDir)
  }
}

await main()
