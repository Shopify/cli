import DocSearch from './search.js'
import {shopifyFetch, Response} from '@shopify/cli-kit/node/http'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
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

afterEach(async () => {
  // Returning exit spies let Oclif queue development warnings after the command completes.
  await new Promise<void>((resolve) => process.nextTick(resolve))
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describeJsonCommand({
  command: DocSearch,
  commandId: 'doc:search',
  moduleURL: import.meta.url,
  args: ['--query', 'webhooks', '--api-name', 'admin', '--api-version', 'latest'],
  expectedResult: {results: [entry], pageInfo: {hasNextPage: null}},
  expectedSchema: {
    type: 'object',
    properties: {
      results: {type: 'array', items: {properties: {domain: {type: ['string', 'null']}}}},
      pageInfo: {properties: {hasNextPage: {type: ['boolean', 'null']}}},
    },
    required: ['results', 'pageInfo'],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(body))
  },
  assertExecuted: () => {
    expect(shopifyFetch).toHaveBeenCalledExactlyOnceWith(
      'https://shopify.dev/assistant/search?query=webhooks&api_name=admin&api_version=latest',
      {headers: {Accept: 'application/json', 'X-Shopify-Surface': 'cli'}},
    )
  },
  assertNotExecuted: () => {
    expect(shopifyFetch).not.toHaveBeenCalled()
  },
  textOutput: {stdout: `${body}\n`, stderr: ''},
  failure: {
    setup: () => {
      vi.mocked(shopifyFetch).mockResolvedValue(
        new Response('<html>nope</html>', {status: 500, statusText: 'Internal Server Error'}),
      )
    },
    expectedError: {error: {type: 'abort', message: 'Search failed: 500 Internal Server Error'}},
    exitCode: 1,
  },
})

describe('doc search command', () => {
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
})
