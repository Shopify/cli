import {fileURLToPath} from 'url'

import path from 'pathe'
import fg from 'fast-glob'

import {external, plugins, distDir} from '../../configurations/rollup.config'

import {dependencies} from './package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const appExternal = [...external, ...Object.keys(dependencies), '@shopify/cli-kit']

const featureCommands = fg.sync([
  path.join(__dirname, `/src/cli/commands/app/**/*.ts`),
  `!${path.join(__dirname, `/src/cli/commands/**/*.test.ts`)}`,
])

const runtimeModules = fg.sync([
  path.join(__dirname, `/src/runtime/**/*.ts`),
  `!${path.join(__dirname, `/src/runtime/**/*.test.ts`)}`,
])

const configuration = () => [
  // CLI
  {
    input: [...featureCommands],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        sourcemap: true,
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId.includes('src/cli/commands')) {
            // Preserves the commands/... path
            return `commands/${chunkInfo.facadeModuleId.split('src/cli/commands').pop().replace('ts', 'js')}`
          } else {
            return '[name].js'
          }
        },
      },
    ],
    plugins: plugins(__dirname),
    external: appExternal,
  },
  {
    input: [...runtimeModules],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        sourcemap: true,
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId.includes('src/runtime')) {
            // Preserves the commands/... path
            return `runtime/${chunkInfo.facadeModuleId.split('src/runtime').pop().replace('ts', 'js')}`
          } else {
            return '[name].js'
          }
        },
      },
    ],
    plugins: plugins(__dirname),
    external: appExternal,
  },
]

export default configuration
