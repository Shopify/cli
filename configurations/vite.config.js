/* eslint-disable import/no-extraneous-dependencies */
import {plugins, aliases} from './rollup.config'
import path from 'pathe'
import {defineConfig} from 'vite'

export default function config(packagePath) {
  return defineConfig({
    build: {
      rollupOptions: {
        plugins: plugins(packagePath),
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
