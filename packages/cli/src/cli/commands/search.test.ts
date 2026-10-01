import Search from './search.js'
import {searchJsonOutputSchema} from '../services/commands/search/types.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  openURL: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
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

  test.each(['--json', '--json-schema'])('writes one document with %s through the launcher', async (flag) => {
    // Keep upgrade checks and other lifecycle hooks out of output assertions.
    vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
    vi.stubEnv('CI', '1')
    vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await launchCLI({
        moduleURL: import.meta.url,
        argv: ['search', 'deploy app', flag],
        lazyCommandLoader: async () => Search,
      })

      expect(openURL).not.toHaveBeenCalled()
      expect(stderr()).toBe('')
      const document = JSON.parse(stdout())
      if (flag === '--json') {
        expect(document).toEqual({url: 'https://shopify.dev/docs?search=deploy+app'})
      } else {
        expect(document.definitions.Result).toMatchObject({
          type: 'object',
          properties: {url: {type: 'string', format: 'uri'}},
          required: ['url'],
        })
      }
    })
  })
})
