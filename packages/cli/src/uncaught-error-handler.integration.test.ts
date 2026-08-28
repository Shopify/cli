import {describe, expect, test} from 'vitest'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'

const errorMessageLength = 1024 * 1024
const handlerUrl = new URL('./uncaught-error-handler.ts', import.meta.url).href

describe('uncaught JSON error process output', () => {
  test('flushes a JSON error to piped stdout before the process exits', async () => {
    const script = `
      const {flushStdout} = await import(${JSON.stringify(handlerUrl)})
      const document = JSON.stringify({error: {type: 'bug', message: 'x'.repeat(${errorMessageLength})}})
      process.stdout.write(document)
      await flushStdout()
      process.exit(1)
    `
    const result = await captureOutputWithExitCode(
      process.execPath,
      ['--loader', 'ts-node/esm', '--input-type=module', '--eval', script],
      {
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NODE_NO_WARNINGS: '1',
          SHOPIFY_UNIT_TEST: 'false',
        },
      },
    )

    expect(result.exitCode, result.stderr).toBe(1)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toStrictEqual({
      error: {type: 'bug', message: 'x'.repeat(errorMessageLength)},
    })
  })
})
