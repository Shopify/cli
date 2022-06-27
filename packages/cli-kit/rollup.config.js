import path from 'pathe'
import dts from 'rollup-plugin-dts'
import {dependencies} from './package.json'

import {external, plugins, distDir} from '../../configurations/rollup.config'
import fg from 'fast-glob'

const cliKitExternal = [...external, ...Object.keys(dependencies)]

const configuration = async () => {
  const files = [
    path.join(__dirname, 'src/index.ts'),
    ...(await fg(path.join(__dirname, 'src/node/*.ts'), {
      ignore: path.join(__dirname, 'src/node/*.test.ts'),
    })),
  ]
  return [
    {
      input: files,
      output: [
        {
          dir: distDir(__dirname),
          format: 'esm',
          sourcemap: true,
          entryFileNames: (chunkInfo) => {
            const facadeModuleId = path.normalize(chunkInfo.facadeModuleId)
            if (facadeModuleId.includes('src/node')) {
              return 'node/[name].js'
            } else {
              return '[name].js'
            }
          },
        },
      ],
      plugins: plugins(__dirname),
      external: cliKitExternal,
    },
    {
      input: files,
      output: [
        {
          dir: distDir(__dirname),
          format: 'esm',
          sourcemap: true,
        },
      ],
      plugins: [dts()],
      external: cliKitExternal,
    },
  ]
}

export default configuration
