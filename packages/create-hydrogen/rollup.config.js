import path from 'pathe'
import alias from '@rollup/plugin-alias'
import {dependencies} from './package.json'

import {external, plugins, distDir} from '../../configurations/rollup.config'

const createHydrogenExternal = [...external, ...Object.keys(dependencies)]
const createHydrogenPlugins = [
  ...plugins(__dirname),
]

const configuration = () => [
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: createHydrogenPlugins,
    external: createHydrogenExternal,
  },
  {
    input: path.join(__dirname, 'src/commands/init.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'commands/init.js'),
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: createHydrogenPlugins,
    external: createHydrogenExternal,
  },
]

export default configuration
