/* eslint-disable import/no-extraneous-dependencies */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {plugins, aliases} from './rollup.config'
import path from 'pathe'
import {defineConfig} from 'vite'

export default function config(packagePath: string) {
  return defineConfig({
    build: {
      rollupOptions: {
        plugins: plugins(packagePath),
      },
    },
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
