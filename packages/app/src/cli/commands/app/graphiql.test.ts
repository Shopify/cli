import AppGraphiQL from './graphiql.js'
import {openAppGraphiQL} from '../../services/app/graphiql.js'
import {prepareAppStoreContext} from '../../utilities/execute-command-helpers.js'
import {
  testAppLinked,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../models/app/app.test-data.js'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/app/graphiql.js')
vi.mock('../../utilities/execute-command-helpers.js')

describe('app graphiql command', () => {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const store = testOrganizationStore({shopDomain: 'shop.myshopify.com'})

  beforeEach(() => {
    vi.mocked(prepareAppStoreContext).mockResolvedValue({
      appContextResult: {
        app,
        remoteApp,
        developerPlatformClient: remoteApp.developerPlatformClient,
        organization: testOrganization(),
        specifications: [],
        project: testProject(),
        activeConfig: {} as never,
      },
      store,
    })
    vi.mocked(openAppGraphiQL).mockResolvedValue()
  })

  test('prepares app/store context and opens GraphiQL', async () => {
    const result = await AppGraphiQL.run([
      '--path',
      '/tmp/app',
      '--client-id',
      'client-id',
      '--store',
      'shop',
      '--port',
      '9123',
      '--variables',
      '{"id":1}',
      '--version',
      '2024-10',
    ])

    expect(prepareAppStoreContext).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/tmp/app',
        'client-id': 'client-id',
        store: 'shop.myshopify.com',
        port: 9123,
        variables: '{"id":1}',
        version: '2024-10',
      }),
    )
    expect(openAppGraphiQL).toHaveBeenCalledWith({
      remoteApp,
      store: 'shop.myshopify.com',
      port: 9123,
      variables: '{"id":1}',
      apiVersion: '2024-10',
      outputFormat: 'text',
    })
    expect(result).toEqual({app})
  })

  test.each([
    {json: false, noInput: false},
    {json: true, noInput: false},
    {json: false, noInput: true},
    {json: true, noInput: true},
  ])('keeps output format independent of input: %j', async ({json, noInput}) => {
    await AppGraphiQL.run([
      '--store',
      'shop.myshopify.com',
      ...(json ? ['--json'] : []),
      ...(noInput ? ['--no-input'] : []),
    ])
    expect(openAppGraphiQL).toHaveBeenCalledWith(expect.objectContaining({outputFormat: json ? 'json' : 'text'}))
  })

  test('exposes the lifecycle schema in command help', () => {
    expect(AppGraphiQL.jsonOutputSchema.name).toBe('GraphiQLRecord')
    expect(AppGraphiQL.description).toContain('Output from `--json` conforms to the `GraphiQLRecord` schema.')
  })

  test('discovers the schema without starting or authenticating GraphiQL', async () => {
    vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await launchCLI({
        moduleURL: new URL('../../../../../cli/src/bootstrap.ts', import.meta.url).href,
        argv: ['app', 'graphiql', '--json-schema'],
        lazyCommandLoader: async () => AppGraphiQL,
      })
      expect(JSON.parse(stdout()).definitions.Result.anyOf).toHaveLength(3)
      expect(openAppGraphiQL).not.toHaveBeenCalled()
      expect(stderr()).toBe('')
    })
  })

  test.each(['--json', '-j'])('keeps fatal errors on stdout and diagnostics on stderr with %s', async (flag) => {
    vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    vi.mocked(openAppGraphiQL).mockImplementationOnce(async () => {
      outputInfo('GraphiQL setup diagnostic')
      throw new AbortError('GraphiQL setup failed.')
    })
    try {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await AppGraphiQL.run(['--store', 'shop.myshopify.com', flag])
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
