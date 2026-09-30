import {defineConfig} from 'vitest/config'
import {availableParallelism} from 'node:os'
import {fileURLToPath} from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    name: 'commands',
    include: ['*.test.ts'],
    globalSetup: ['./support/build.ts'],
    // Coverage builds use more memory and CPU per child. Keep enough headroom for
    // PTY prompts and filesystem writes to complete within their normal deadlines.
    maxConcurrency: process.env.SHOPIFY_CLI_SOURCE_COVERAGE === '1' ? 4 : availableParallelism(),
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: 'forks',
  },
})
