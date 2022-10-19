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
      threads: false,
      testTimeout: 10000,
    },
  })
}

export const aliases = (packagePath: string) => {
  return [
    {
      find: /@shopify\/cli-kit\/(.+)/,
      replacement: (importedModule: string) => {
        const migratedTsModules = ['array']
        const migratedTsxModules = ['ui']
        if (migratedTsModules.find((module) => importedModule.endsWith(module))) {
          return path.join(packagePath, `../cli-kit/src/public/${importedModule.replace('@shopify/cli-kit/', '')}.ts`)
        } else if (migratedTsxModules.find((module) => importedModule.endsWith(module))) {
          return path.join(packagePath, `../cli-kit/src/public/${importedModule.replace('@shopify/cli-kit/', '')}.tsx`)
        } else {
          return path.join(packagePath, `../cli-kit/src/${importedModule.replace('@shopify/cli-kit/', '')}.ts`)
        }
      },
    },
    {find: '@shopify/cli-kit', replacement: path.join(packagePath, '../cli-kit/src/index.ts')},
  ]
}
