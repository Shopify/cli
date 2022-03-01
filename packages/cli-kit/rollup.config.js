import path from 'pathe'
import dts from 'rollup-plugin-dts'

import {external, plugins, distDir} from '../../configurations/rollup.config'

const cliKitExternal = [...external]

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
    plugins: plugins(__dirname),
    external: cliKitExternal,
  },
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'index.d.ts'),
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      dts({
        respectExternal: true,
        compilerOptions: {
          composite: false,
        },
      }),
    ],
    external: cliKitExternal,
  },
]

export default configuration
