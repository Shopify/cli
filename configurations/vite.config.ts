/* eslint-disable import/no-extraneous-dependencies */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as path from 'pathe'
import {defineConfig} from 'vitest/config'

const TIMEOUTS = {
  normal: 5000,
  windows: 13000,
  macos: 13000,
  debug: 180000,
}

interface ConfigOptions {
  poolStrategy: 'threads' | 'forks'
}

export default function config(packagePath: string, {poolStrategy}: ConfigOptions = {poolStrategy: 'threads'}) {
  // always treat environment as one that doesn't support hyperlinks -- otherwise assertions are hard to keep consistent
  process.env['FORCE_HYPERLINK'] = '0'
  process.env['FORCE_COLOR'] = '1'

  let testTimeout = TIMEOUTS.normal
  if (process.env['VITEST_SKIP_TIMEOUT'] === '1') {
    testTimeout = TIMEOUTS.debug
  } else if (process.env['RUNNER_OS'] === 'Windows') {
    testTimeout = TIMEOUTS.windows
  } else if (process.env['RUNNER_OS'] === 'macOS') {
    testTimeout = TIMEOUTS.macos
  }

  return defineConfig({
    resolve: {
      alias: aliases(packagePath),
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    test: {
      testTimeout,
      clearMocks: true,
      mockReset: true,
      setupFiles: [path.join(__dirname, './vitest/setup.js')],
      reporters: ['verbose', 'hanging-process'],
      pool: poolStrategy,
      coverage: {
        provider: 'istanbul',
        include: ['**/src/**'],
        all: true,
        reporter: ['text', 'json', 'lcov'],
        exclude: ['**/src/**/vendor/**'],
      },
      snapshotFormat: {
        escapeString: true,
      },
      includeSource: ['**/src/**/*.{ts,tsx}'],
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
