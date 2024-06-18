/* eslint-disable import/no-extraneous-dependencies */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as path from 'pathe'
import {defineConfig} from 'vitest/config'

export default function config(packagePath: string) {
  // always treat environment as one that doesn't support hyperlinks -- otherwise assertions are hard to keep consistent
  process.env['FORCE_HYPERLINK'] = '0'
  process.env['FORCE_COLOR'] = '1'

  return defineConfig({
    resolve: {
      alias: aliases(packagePath),
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    test: {
      testTimeout:
        process.env['VITEST_SKIP_TIMEOUT'] === '1' ? 180000 : process.env['RUNNER_OS'] === 'Windows' ? 13000 : 5000,
      clearMocks: true,
      mockReset: true,
      setupFiles: [path.join(__dirname, './vitest/setup.js')],
      reporters: ['verbose', 'hanging-process'],
      threads: false,
      coverage: {
        provider: 'istanbul',
        include: ['**/src/**'],
        all: true,
        reporter: ['text', 'json', 'lcov'],
      },
      snapshotFormat: {
        escapeString: true,
      },
    },
  })
}

export const aliases = (packagePath: string) => {
  return [
    {
      find: /@shopify\/cli-kit\/(.+)/,
      replacement: (importedModule: string) => {
        return path.join(packagePath, `../cli-kit/src/public/${importedModule.replace('@shopify/cli-kit/', '')}`)
      },
    },
    {find: '@shopify/cli-kit', replacement: path.join(packagePath, '../cli-kit/src/index')},
  ]
}
