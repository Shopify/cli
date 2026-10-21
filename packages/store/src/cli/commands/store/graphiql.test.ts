import StoreGraphiQL from './graphiql.js'
import {openStoreGraphiQL} from '../../services/store/graphiql.js'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/graphiql.js', () => ({openStoreGraphiQL: vi.fn()}))
vi.mock('../../services/store/attribution.js')

describe('store graphiql command', () => {
  beforeEach(() => {
    vi.mocked(openStoreGraphiQL).mockResolvedValue()
  })

  test('opens GraphiQL with mutations disabled by default', async () => {
    await StoreGraphiQL.run(['--store', 'shop.myshopify.com'])

    expect(openStoreGraphiQL).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      port: undefined,
      allowMutations: false,
      variables: undefined,
      apiVersion: undefined,
      outputFormat: 'text',
    })
  })

  test('forwards optional GraphiQL configuration', async () => {
    await StoreGraphiQL.run([
      '--store',
      'shop.myshopify.com',
      '--port',
      '9123',
      '--allow-mutations',
      '--variables',
      '{"id":"gid://shopify/Product/1"}',
      '--version',
      '2024-10',
    ])

    expect(openStoreGraphiQL).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      port: 9123,
      allowMutations: true,
      variables: '{"id":"gid://shopify/Product/1"}',
      apiVersion: '2024-10',
      outputFormat: 'text',
    })
  })

  test.each([
    {json: false, noInput: false},
    {json: true, noInput: false},
    {json: false, noInput: true},
    {json: true, noInput: true},
  ])('keeps output format independent of input: %j', async ({json, noInput}) => {
    await StoreGraphiQL.run([
      '--store',
      'shop.myshopify.com',
      ...(json ? ['--json'] : []),
      ...(noInput ? ['--no-input'] : []),
    ])
    expect(openStoreGraphiQL).toHaveBeenCalledWith(expect.objectContaining({outputFormat: json ? 'json' : 'text'}))
  })

  test('exposes the lifecycle schema in command help', () => {
    expect(StoreGraphiQL.jsonOutputSchema.name).toBe('GraphiQLRecord')
    expect(StoreGraphiQL.description).toContain('JSONL stream')
  })

  test('discovers the schema without starting or authenticating GraphiQL', async () => {
    vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await launchCLI({
        moduleURL: new URL('../../../../../cli/src/bootstrap.ts', import.meta.url).href,
        argv: ['store', 'graphiql', '--json-schema'],
        lazyCommandLoader: async () => StoreGraphiQL,
      })
      expect(JSON.parse(stdout()).definitions.Result.anyOf).toHaveLength(3)
      expect(openStoreGraphiQL).not.toHaveBeenCalled()
      expect(stderr()).toBe('')
    })
  })

  test.each(['--json', '-j'])('keeps fatal errors on stdout and diagnostics on stderr with %s', async (flag) => {
    vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    vi.mocked(openStoreGraphiQL).mockImplementationOnce(async () => {
      outputInfo('GraphiQL setup diagnostic')
      throw new AbortError('GraphiQL setup failed.')
    })
    try {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await StoreGraphiQL.run(['--store', 'shop.myshopify.com', flag])
        expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'GraphiQL setup failed.'}})
        expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'GraphiQL setup diagnostic'})
        expect(exit).toHaveBeenCalledWith(1)
      })
    } finally {
      exit.mockRestore()
      vi.unstubAllEnvs()
    }
  })
})
