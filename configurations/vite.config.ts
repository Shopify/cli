/* eslint-disable import/no-extraneous-dependencies */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import path from 'pathe'
import {defineConfig} from 'vite'

export default function config(packagePath: string) {
  return defineConfig({
    resolve: {
      alias: aliases(packagePath),
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    test: {
      clearMocks: true,
      mockReset: true,
      setupFiles: [path.join(__dirname, './vitest/setup.js')],
    },
  })
}

export const aliases = (packagePath: string) => {
  return [
    {find: /@shopify\/cli-kit\/(.+)/, replacement: path.join(packagePath, '../cli-kit/src/$1.ts')},
    {find: '@shopify/cli-kit', replacement: path.join(packagePath, '../cli-kit/src/index.ts')},
  ]
}
