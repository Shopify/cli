import {execa} from 'execa'
import {describe, expect, test} from 'vitest'
import {fileURLToPath} from 'node:url'

const fixturePath = fileURLToPath(new URL('../../../test/fixtures/json-error-process.ts', import.meta.url))

describe('JSON fatal error process output', () => {
  // Starting a fresh TypeScript subprocess needs extra startup headroom under loaded CI runners.
  test(
    'writes one JSON document to stdout, diagnostics to stderr, and preserves the exit code',
    {timeout: 20000},
    async () => {
      const result = await execa(process.execPath, ['--loader', 'ts-node/esm', fixturePath, '--json'], {
        env: {SHOPIFY_UNIT_TEST: 'false', FORCE_COLOR: '0', NODE_NO_WARNINGS: '1'},
        reject: false,
      })

      expect(result.exitCode, result.stderr).toBe(2)
      expect(JSON.parse(result.stdout)).toStrictEqual({
        error: {
          type: 'abort',
          message: 'Expected failure',
          tryMessage: 'Run shopify app dev again.',
          nextSteps: ['Read the documentation (https://shopify.dev).'],
          customSections: [{title: 'Details', body: 'The app could not be loaded.'}],
        },
      })
      expect(result.stdout.trim().split('\n')).toHaveLength(1)
      expect(result.stderr).toBe('Recoverable diagnostic')
    },
  )
})
