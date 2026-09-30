import Search from './search.js'
import {searchJsonOutputSchema} from '../services/commands/search/types.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {execa} from 'execa'

vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  openURL: vi.fn(),
}))

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('search command', () => {
  test.each(['deploy app', ''])('opens the browser without printing a result in text mode for %j', async (query) => {
    const output = mockAndCaptureOutput()
    const url = query ? 'https://shopify.dev/docs?search=deploy+app' : 'https://shopify.dev/docs?search='

    await Search.run(query ? [query] : [], import.meta.url)

    expect(openURL).toHaveBeenCalledWith(url)
    expect(output.output()).toBe('')
    expect(output.warn()).toBe('')
  })

  test.each(['deploy app', ''])(
    'prints the search URL without opening the browser in JSON mode for %j',
    async (query) => {
      const output = mockAndCaptureOutput()
      const url = query ? 'https://shopify.dev/docs?search=deploy+app' : 'https://shopify.dev/docs?search='

      await Search.run([...(query ? [query] : []), '--json'], import.meta.url)

      expect(openURL).not.toHaveBeenCalled()
      expect(output.output()).toBe(JSON.stringify({url}, null, 2))
      expect(output.warn()).toBe('')
    },
  )

  test('exposes the result schema in help', () => {
    expect(Search.jsonOutputSchema).toBe(searchJsonOutputSchema)
    expect(Search.description).toContain('Output from `--json` conforms to the `SearchResult` schema.')
  })

  test.each([{}, {url: 123}, {url: 'not a URL'}])('rejects an invalid result: %j', (result) => {
    expect(() => searchJsonOutputSchema.validate(result)).toThrow()
  })

  test.each(['--json', '--json-schema'])(
    'writes one document with %s through the launcher',
    {timeout: 60000},
    async (flag) => {
      const commandUrl = new URL('./search.ts', import.meta.url).href
      const sourceLoaderUrl = new URL('../../../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url)
        .href
      const script = `
      const {default: Search} = await import(${JSON.stringify(commandUrl)})
      const {launchCLI} = await import('@shopify/cli-kit/node/cli-launcher')
      await launchCLI({
        moduleURL: ${JSON.stringify(commandUrl)},
        argv: ['search', 'deploy app', ${JSON.stringify(flag)}],
        lazyCommandLoader: async () => Search,
      })
    `

      const result = await execa(
        process.execPath,
        ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
        {
          env: {
            ...process.env,
            FORCE_COLOR: '0',
            NODE_NO_WARNINGS: '1',
            SHOPIFY_CLI_ENV: 'development',
            SHOPIFY_CLI_NO_ANALYTICS: '1',
            SHOPIFY_UNIT_TEST: 'false',
            // Cloud environments cannot open a local browser.
            CODESPACES: 'true',
          },
          reject: false,
          // Source-loader startup can exceed 20 seconds on Windows CI. Stop a hung child before the test times out.
          timeout: 45000,
        },
      )

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      const document = JSON.parse(result.stdout)
      if (flag === '--json') {
        expect(document).toEqual({url: 'https://shopify.dev/docs?search=deploy+app'})
      } else {
        expect(document.definitions.Result).toMatchObject({
          type: 'object',
          properties: {url: {type: 'string', format: 'uri'}},
          required: ['url'],
        })
      }
    },
  )
})
