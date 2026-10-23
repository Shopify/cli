import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {describe, expect, test} from 'vitest'

const bootstrapUrl = new URL('./bootstrap.ts', import.meta.url).href
const sessionUrl = new URL('../../cli-kit/src/public/node/graphiql/session.ts', import.meta.url).href
const sourceLoaderUrl = new URL('../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url).href

describe('GraphiQL shutdown through the CLI bootstrap', () => {
  test.each([
    ['SIGINT', 'sigint', 130],
    ['SIGTERM', 'sigterm', 143],
  ])('flushes lifecycle records and closes the server after %s', {timeout: 20000}, async (signal, reason, exitCode) => {
    const script = `
      await import(${JSON.stringify(bootstrapUrl)})
      const {runGraphiQLSession} = await import(${JSON.stringify(sessionUrl)})
      const write = process.stdout.write.bind(process.stdout)
      let url
      process.stdout.write = (chunk, ...args) => {
        const result = write(chunk, ...args)
        if (String(chunk).includes('"type":"ready"')) {
          url = JSON.parse(String(chunk)).url
          setImmediate(() => process.emit(${JSON.stringify(signal)}))
        }
        return result
      }
      await runGraphiQLSession({
        storeFqdn: 'shop.myshopify.com', key: 'key',
        tokenProvider: {getToken: async () => 'token'}, outputFormat: 'json',
      })
      process.stdout.write = write
      try {
        await fetch(new URL('/graphiql/ping', url))
        throw new Error('GraphiQL is still listening after shutdown')
      } catch (error) {
        if (error.message !== 'fetch failed') throw error
      }
    `
    const result = await captureOutputWithExitCode(
      process.execPath,
      ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
      {
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NODE_NO_WARNINGS: '1',
          // Unit-test CI has no built workspace declarations; runtime imports still resolve through the source loader.
          TS_NODE_IGNORE_DIAGNOSTICS: '2307',
          SHOPIFY_UNIT_TEST: 'false',
          SHOPIFY_FLAG_NO_INPUT: '1',
        },
      },
    )

    expect(result.exitCode, JSON.stringify(result)).toBe(exitCode)
    expect(result.stderr).toBe('')
    const records = result.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(records.map((record) => record.type)).toEqual(['starting', 'ready', 'stopped'])
    expect(records.at(-1)).toMatchObject({reason})
  })
})
