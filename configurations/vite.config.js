/* eslint-disable import/no-extraneous-dependencies */
import {plugins} from './rollup.config'
import path from 'pathe'
import {defineConfig} from 'vite'

const aliases = (packagePath) => {
  return [
    {find: '@shopify/cli-testing', replacement: path.join(__dirname, '../packages/cli-testing/src/index.ts')},
    {find: '@shopify/cli-kit', replacement: path.join(__dirname, '../packages/cli-kit/src/index.ts')},
    {find: new RegExp('^\\$(.*)$'), replacement: path.join(packagePath, './src/$1.ts')},
  ]
}

export default function config(packagePath) {
  return defineConfig({
    build: {
      rollupOptions: {
        plugins: plugins(packagePath, aliases(packagePath)),
      },
    },
    resolve: {
      alias: aliases(packagePath),
    },
    // @ts-ignore
    test: {
      clearMocks: true,
      mockReset: true,
      setupFiles: [path.join(__dirname, './vitest/setup.js')],
    },
  })
}
