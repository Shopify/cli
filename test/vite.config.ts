import {defineConfig} from 'vitest/config'
import {availableParallelism} from 'node:os'
import {fileURLToPath} from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    name: 'commands',
    include: ['*.test.ts'],
    globalSetup: ['./support/build.ts'],
    // Cases own their CLI processes and sandboxes; avoid unbounded process fan-out.
    maxConcurrency: availableParallelism(),
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: 'forks',
  },
})
