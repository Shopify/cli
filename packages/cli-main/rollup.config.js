import {fileURLToPath} from 'url'

import path from 'pathe'
import fg from 'fast-glob'

import {external, plugins, distDir} from '../../configurations/rollup.config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const hydrogenExternal = [/@miniflare/, /prettier/]
const cliExternal = [...external, ...hydrogenExternal]

const cliCommands = fg.sync([
  path.join(__dirname, `/src/cli/commands/**/*.ts`),
  `!${path.join(__dirname, `/src/cli/commands/**/*.test.ts`)}`,
])

const cliHooks = fg.sync([
  path.join(__dirname, `/src/hooks/**/*.ts`),
  `!${path.join(__dirname, `/src/hooks/**/*.test.ts`)}`,
])

const configuration = () => [
  // CLI
  {
    input: [path.join(__dirname, 'src/index.ts')],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: plugins(__dirname),
    external: cliExternal,
  },
  {
    input: [...cliCommands, ...cliHooks],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        sourcemap: true,
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = path.normalize(chunkInfo.facadeModuleId)
          if (facadeModuleId.includes('src/cli/commands')) {
            // Preserves the commands/... path
            return `commands/${facadeModuleId.split('src/cli/commands').pop().replace('ts', 'js')}`
          } else if (facadeModuleId.includes('src/hooks')) {
            // Preserves the hooks/... path
            return `hooks/${facadeModuleId.split('src/hooks').pop().replace('ts', 'js')}`
          } else {
            return '[name].js'
          }
        },
      },
    ],
    plugins: plugins(__dirname),
    external: cliExternal,
  },
]

export default configuration
