import DocSearch from './search.js'
import {docSearchJsonOutputSchema} from '../../services/commands/doc/types.js'
import {shopifyFetch, Response} from '@shopify/cli-kit/node/http'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  shopifyFetch: vi.fn(),
}))

const entry = {score: 0.99, content: 'About webhooks', url: 'https://shopify.dev/x', title: 'Webhooks', domain: null}
const body = `[\n  {"title":"Webhooks","url":"https://shopify.dev/x","content":"About webhooks","score":0.99,"domain":null}\n]`

beforeEach(() => {
  vi.stubEnv('CI', '1')
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  vi.mocked(shopifyFetch).mockResolvedValue(new Response(body))
  vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describe('doc search command', () => {
  test('preserves the exact response bytes on stdout without JSON selection', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocSearch.run(['--query', 'webhooks', '--no-input'], import.meta.url)
      expect(stdout()).toBe(`${body}\n`)
      expect(stderr()).toBe('')
    })
  })

  test.each([
    'not JSON',
    JSON.stringify([{...entry, title: null}]),
    JSON.stringify([{score: entry.score, content: entry.content, url: entry.url, domain: entry.domain}]),
  ])('preserves raw successful responses outside the JSON schema: %s', async (response) => {
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(response))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocSearch.run(['--query', 'webhooks', '--no-input'], import.meta.url)
      expect(stdout()).toBe(`${response}\n`)
      expect(stderr()).toBe('')
      expect(process.exit).not.toHaveBeenCalled()
    })
  })

  test.each([
    JSON.stringify([{...entry, title: null}]),
    JSON.stringify([{score: entry.score, content: entry.content, url: entry.url, domain: entry.domain}]),
  ])('reports incompatible search data as one fatal JSON document: %s', async (response) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(response))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocSearch.run(['--query', 'webhooks', '--json'], import.meta.url)
      expect(JSON.parse(stdout())).toEqual({
        error: {type: 'abort', message: 'Search returned an invalid documentation response.'},
      })
      expect(stderr()).toBe('')
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  test.each([{flags: []}, {flags: ['--no-input']}])(
    'writes one result object with JSON and flags $flags',
    async ({flags}) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await DocSearch.run(
          ['--query', 'webhooks', '--api-name', 'admin', '--api-version', 'latest', '--json', ...flags],
          import.meta.url,
        )
        expect(JSON.parse(stdout())).toEqual({results: [entry], pageInfo: {hasNextPage: null}})
        expect(stderr()).toBe('')
        expect(shopifyFetch).toHaveBeenCalledWith(
          'https://shopify.dev/assistant/search?query=webhooks&api_name=admin&api_version=latest',
          {
            headers: {Accept: 'application/json', 'X-Shopify-Surface': 'cli'},
          },
        )
      })
    },
  )

  test('supports the shared JSON environment flag', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocSearch.run(['--query', 'webhooks'], import.meta.url)
      expect(JSON.parse(stdout())).toEqual({results: [entry], pageInfo: {hasNextPage: null}})
      expect(stderr()).toBe('')
    })
  })

  test('reports missing required input before making a request', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocSearch.run(['--json', '--no-input'], import.meta.url)
      expect(JSON.parse(stdout())).toHaveProperty('error')
      expect(process.exit).toHaveBeenCalledWith(2)
      expect(stderr()).toBe('')
      expect(shopifyFetch).not.toHaveBeenCalled()
    })
  })

  test.each([{results: []}, {results: [{...entry, score: 0, domain: 'admin'}]}])(
    'encodes empty results and nullable metadata: $results',
    async ({results}) => {
      vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify(results)))
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await DocSearch.run(['--query', 'webhooks', '--json'], import.meta.url)
        expect(JSON.parse(stdout())).toEqual({results, pageInfo: {hasNextPage: null}})
        expect(stderr()).toBe('')
      })
    },
  )

  test.each([
    {
      status: 400,
      statusText: 'Bad Request',
      response: '{"error":"Invalid api_version"}',
      message: 'Search failed: Invalid api_version',
    },
    {
      status: 500,
      statusText: 'Internal Server Error',
      response: '<html>nope</html>',
      message: 'Search failed: 500 Internal Server Error',
    },
    {
      status: 200,
      statusText: 'OK',
      response: 'not JSON',
      message: 'Search returned an invalid documentation response.',
    },
  ])('reports $status failures through the shared error document', async ({status, statusText, response, message}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(response, {status, statusText}))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(DocSearch.run(['--query', 'webhooks', '--json'], import.meta.url)).resolves.toBeUndefined()
      expect(process.exit).toHaveBeenCalledWith(1)
      expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message}})
      expect(stderr()).toBe('')
    })
  })

  test('keeps the transport failure guidance and nonzero exit', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(shopifyFetch).mockRejectedValue(new Error('getaddrinfo ENOTFOUND shopify.dev'))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(DocSearch.run(['--query', 'webhooks', '--json'], import.meta.url)).resolves.toBeUndefined()
      expect(process.exit).toHaveBeenCalledWith(1)
      expect(JSON.parse(stdout())).toEqual({
        error: {
          type: 'abort',
          message: 'Could not reach shopify.dev to run the search.',
          tryMessage: 'Check your network connection and try again.',
        },
      })
      expect(stderr()).toBe('')
    })
  })

  test('exposes the schema in help and through the launcher without a search request', async () => {
    expect(DocSearch.jsonOutputSchema).toBe(docSearchJsonOutputSchema)
    expect(DocSearch.flags.json).toBeDefined()
    expect(DocSearch.description).toContain('Output from `--json` conforms to the `DocSearchResult` schema.')
    vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await launchCLI({
        moduleURL: import.meta.url,
        argv: ['doc', 'search', '--json-schema'],
        lazyCommandLoader: async () => DocSearch,
      })
      const schema = JSON.parse(stdout())
      expect(schema.definitions.Result.required).toEqual(['results', 'pageInfo'])
      expect(schema.definitions.Result.properties.results.items.properties.domain.type).toEqual(['string', 'null'])
      expect(schema.definitions.Result.additionalProperties).toBe(false)
      expect(stderr()).toBe('')
      expect(shopifyFetch).not.toHaveBeenCalled()
    })
  })
})
