import {describe, expect, test} from 'vitest'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'

const errorMessageLength = 1024 * 1024
const handlerUrl = new URL('./uncaught-error-handler.ts', import.meta.url).href
const sourceLoaderUrl = new URL('../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url).href

describe('uncaught JSON error process output', () => {
  test('flushes a JSON error to piped stdout before the process exits', {timeout: 20000}, async () => {
    const script = `
      const {renderUncaughtError} = await import(${JSON.stringify(handlerUrl)})
      await renderUncaughtError({type: 0, message: 'x'.repeat(${errorMessageLength})})
      process.exit(1)
    `
    const result = await captureOutputWithExitCode(
      process.execPath,
      ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
      {
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NODE_NO_WARNINGS: '1',
          SHOPIFY_UNIT_TEST: 'false',
          SHOPIFY_FLAG_JSON: '1',
        },
      },
    )

    expect(result.exitCode, result.stderr).toBe(1)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toStrictEqual({
      error: {type: 'abort', message: 'x'.repeat(errorMessageLength)},
    })
  })
})
